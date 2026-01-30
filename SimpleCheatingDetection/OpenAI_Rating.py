import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()


class InterviewRater:
    def __init__(self, api_key: str | None = None):
        self.client = OpenAI(
            api_key=api_key or os.getenv("OPENAI_API_KEY")
        )

    # ---------------- TRANSCRIPTION ---------------- #

    def get_transcription(self, audio_file_path: str) -> str:
        if not os.path.exists(audio_file_path):
            raise FileNotFoundError(f"Audio file not found: {audio_file_path}")

        if os.path.getsize(audio_file_path) == 0:
            raise ValueError("Audio file is empty")

        print("🎧 Transcribing audio...")

        with open(audio_file_path, "rb") as audio_file:
            transcription = self.client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-1",
                language="en"
            )

        return transcription.text

    # ---------------- Q&A EXTRACTION ---------------- #

    def extract_qa_pairs(self, transcription_text: str) -> list:
        print("🧠 Extracting Q&A pairs...")

        prompt = f"""
You are an expert interviewer.

From the interview transcription below, extract question–answer pairs.

Return ONLY valid JSON in this exact format:
[
  {{ "question": "question text", "answer": "answer text" }}
]

Transcription:
\"\"\"{transcription_text}\"\"\"
"""

        response = self.client.responses.create(
            model="gpt-5",
            reasoning={"effort": "medium"},
            input=prompt,
        )

        return json.loads(response.output_text)

    # ---------------- RATINGS ---------------- #

    def rate_qa_pairs(self, qa_pairs: list, role: str) -> list:
        print("📊 Rating Q&A pairs...")

        prompt = f"""
You are an expert QA analyst.

From the list of question–answer pairs below, keep ONLY questions
that are relevant to evaluating a {role} candidate.

REMOVE questions about:
- audio/video checks
- screen sharing
- repetitions
- logistics or small talk

For the remaining pairs:

Rate each question and each answer separately on a scale of 0–5
based on clarity, coherence, relevance, and suitability for a {role} interview.

Questions should be rated carefully for relevance.
Answers should be rated more on conceptual correctness than language.

Return ONLY valid JSON in this format:
[
  {{
    "question": "question text",
    "question_rating": 0,
    "answer": "answer text",
    "answer_rating": 0
  }}
]

Q&A Pairs:
{json.dumps(qa_pairs, indent=2)}
"""

        response = self.client.responses.create(
            model="gpt-5",
            reasoning={"effort": "medium"},
            input=prompt,
        )

        return json.loads(response.output_text)

    # ---------------- PIPELINE ---------------- #

    def rate_interview(self, audio_path: str, role: str) -> list:
        transcription = self.get_transcription(audio_path)
        print("\n📝 TRANSCRIPTION:\n", transcription)

        qa_pairs = self.extract_qa_pairs(transcription)
        print("\n❓ Q&A PAIRS:\n", json.dumps(qa_pairs, indent=2))

        ratings = self.rate_qa_pairs(qa_pairs, role)
        return ratings
