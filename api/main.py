
import re

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Workout Import API")


class ImportRequest(BaseModel):
    text: str = Field(min_length=10, max_length=8000)


class Exercise(BaseModel):
    name: str
    sets: int | None = None
    reps_min: int | None = None
    reps_max: int | None = None
    rest_seconds: int | None = None
    notes: str | None = None


class WorkoutDraft(BaseModel):
    title: str
    exercises: list[Exercise]
    warnings: list[str]


EXERCISE_PATTERN = re.compile(
    r"^(?P<name>.+?)\s*[-:–]?\s*"
    r"(?P<sets>\d{1,2})\s*"
    r"(?:sets?\s*(?:(?:of|x|×)\s*)?|[x×]\s*)"
    r"(?P<reps_min>\d{1,3})"
    r"(?:\s*(?:-|–|to)\s*(?P<reps_max>\d{1,3}))?"
    r"\s*(?:reps?)?(?P<notes>.*)$",
    re.IGNORECASE,
)

REST_PATTERN = re.compile(
    r"\brest\s*(?:for\s*)?(\d{1,3})\s*"
    r"(seconds?|secs?|sec\b|s\b|minutes?|mins?|min\b|m\b)",
    re.IGNORECASE,
)

TITLE_PATTERN = re.compile(
    r"^\s*([^\n:!]{2,55}?(?:day|workout|routine))\s*[:!]\s*",
    re.IGNORECASE,
)


def extract_workout(text: str) -> WorkoutDraft:
    title = "Imported Workout"

    title_match = TITLE_PATTERN.match(text)

    if title_match:
        title = title_match.group(1).strip().title()
        text = text[title_match.end():]

    rest_match = REST_PATTERN.search(text)
    rest_seconds = None

    if rest_match:
        rest_seconds = int(rest_match.group(1))

        if rest_match.group(2).lower().startswith("m"):
            rest_seconds *= 60

    parts = re.split(
        r"[,;\n]|[.!?](?=\s|$)|"
        r"\band\s+finish\s+with\b|\bthen\b",
        text,
        flags=re.IGNORECASE,
    )

    exercises = []
    ignored = []

    for part in parts:
        part = part.strip()

        if not part:
            continue

        part = re.sub(
            r"^(?:start with|and|finish with|do|next|followed by)\s+",
            "",
            part,
            flags=re.IGNORECASE,
        )

        match = EXERCISE_PATTERN.match(part)

        if not match:
            if re.search(r"\d", part) and not part.lower().startswith("rest"):
                ignored.append(part)
            continue

        sets = int(match.group("sets"))
        reps_min = int(match.group("reps_min"))
        reps_max = int(match.group("reps_max") or reps_min)

        if not (
            1 <= sets <= 20
            and 1 <= reps_min <= 300
            and reps_min <= reps_max <= 300
        ):
            ignored.append(part)
            continue

        exercises.append(
            Exercise(
                name=match.group("name").strip(" :-–").title(),
                sets=sets,
                reps_min=reps_min,
                reps_max=reps_max,
                rest_seconds=rest_seconds,
                notes=match.group("notes").strip(" .;–-") or None,
            )
        )

    warnings = []

    if not exercises:
        warnings.append(
            "No supported exercises found. "
            "Try: Squats 3x10, Lunges 3 sets of 12 reps."
        )

    if ignored:
        warnings.append(
            "Review unrecognized text: " + "; ".join(ignored[:3])
        )

    return WorkoutDraft(
        title=title,
        exercises=exercises,
        warnings=warnings,
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/imports/preview", response_model=WorkoutDraft)
def preview_workout(request: ImportRequest):
    return extract_workout(request.text)
