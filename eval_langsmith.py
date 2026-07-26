import os
from dotenv import load_dotenv
from langsmith import Client
from langsmith.evaluation import evaluate
from core.rag_engine import build_rag_chain

load_dotenv()

# Sample Meeting Transcript for Benchmark Evaluation
SAMPLE_TRANSCRIPT = """
Meeting Topic: Q3 AI Assistant Roadmap & Budget
Date: July 24, 2026
Attendees: Medhu (Tech Lead), Alex (Product Manager), Sarah (Backend Engineer)

Key Discussion Points:
1. Alex proposed launching the new RAG Feature by August 15th, 2026.
2. Sarah reported that ChromaDB vector search latency was reduced from 300ms to 45ms after upgrading chunking parameters.
3. Medhu approved a $5,000 budget increase for Sarvam AI audio translation APIs.
4. Action Items:
   - Sarah will configure LangSmith evaluation pipelines by Friday.
   - Alex will update the client documentation by next Monday.
   - Medhu will oversee the production server deployment on AWS.
"""

# Benchmark Test Dataset (Questions & Expected Answers)
TEST_INPUTS = [
    {
        "inputs": {"question": "What is the target release date for the RAG feature?"},
        "outputs": {"answer": "August 15th, 2026"},
    },
    {
        "inputs": {"question": "Who approved the budget increase for Sarvam AI?"},
        "outputs": {"answer": "Medhu approved the $5,000 budget increase."},
    },
    {
        "inputs": {"question": "What is Sarah's assigned action item and deadline?"},
        "outputs": {"answer": "Sarah needs to configure LangSmith evaluation pipelines by Friday."},
    },
    {
        "inputs": {"question": "What is the budget allocated for marketing?"},
        "outputs": {"answer": "I could not find relevant information in the transcript for that question."},
    },
]


def prepare_dataset(client: Client, dataset_name: str):
    """Creates or retrieves the evaluation dataset in LangSmith."""
    if client.has_dataset(dataset_name=dataset_name):
        print(f"Dataset '{dataset_name}' already exists in LangSmith.")
        return client.read_dataset(dataset_name=dataset_name)

    print(f"Creating benchmark dataset '{dataset_name}' in LangSmith...")
    dataset = client.create_dataset(
        dataset_name=dataset_name,
        description="Benchmark QA dataset for AI Video Assistant RAG evaluation",
    )

    for item in TEST_INPUTS:
        client.create_example(
            inputs=item["inputs"],
            outputs=item["outputs"],
            dataset_id=dataset.id,
        )

    print(f"Dataset '{dataset_name}' created with {len(TEST_INPUTS)} examples.")
    return dataset


# Target Function to Evaluate
def predict_rag_answer(inputs: dict) -> dict:
    """Target function that wraps our RAG pipeline for LangSmith evaluation."""
    rag_chain = build_rag_chain(SAMPLE_TRANSCRIPT, meeting_id="eval_benchmark_meeting")
    question = inputs["question"]
    response = rag_chain.invoke({"question": question, "chat_history": []})
    return {"answer": response}


# Custom Evaluator 1: Key Keyword Match Score
def keyword_similarity_evaluator(run, example) -> dict:
    """Evaluates if key reference terms appear in the model answer."""
    prediction = run.outputs.get("answer", "").lower()
    reference = example.outputs.get("answer", "").lower()

    reference_words = [w for w in reference.split() if len(w) > 3]
    if not reference_words:
        score = 1.0
    else:
        matches = sum(1 for word in reference_words if word in prediction)
        score = round(matches / len(reference_words), 2)

    return {
        "key": "keyword_match_score",
        "score": score,
        "comment": f"Matched {score * 100}% of reference key terms.",
    }


# Custom Evaluator 2: Anti-Hallucination / Strict Answer Accuracy
def hallucination_evaluator(run, example) -> dict:
    """Scores whether the model correctly identified missing information."""
    prediction = run.outputs.get("answer", "").lower()
    reference = example.outputs.get("answer", "").lower()

    if "could not find" in reference:
        passed = "could not find" in prediction or "not mentioned" in prediction
        return {
            "key": "anti_hallucination_score",
            "score": 1.0 if passed else 0.0,
            "comment": "Correctly refused ungrounded question" if passed else "Hallucinated an answer",
        }

    return {
        "key": "anti_hallucination_score",
        "score": 1.0,
        "comment": "Grounded response",
    }


def run_langsmith_evaluation():
    client = Client()
    dataset_name = "Meeting_Assistant_RAG_Eval"

    # Step 1: Prepare Dataset
    dataset = prepare_dataset(client, dataset_name)

    # Step 2: Run LangSmith Evaluation
    print("\nStarting LangSmith Automated Evaluation Experiment...")
    results = evaluate(
        predict_rag_answer,
        data=dataset.name,
        evaluators=[keyword_similarity_evaluator, hallucination_evaluator],
        experiment_prefix="rag-eval-mistral",
        metadata={"model": "mistral-small-latest", "chunk_size": 800},
    )

    print("\n✅ Evaluation complete! View full experiment matrix at https://smith.langchain.com")
    return results


if __name__ == "__main__":
    run_langsmith_evaluation()
