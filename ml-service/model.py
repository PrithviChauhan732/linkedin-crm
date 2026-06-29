import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline as SkPipeline
from dataset import TRAINING_DATA

INTENT_STAGE_MAP = {
    "interested": "replied",
    "form_request": "replied",
    "not_hiring": "not_replied",
    "not_interested": "not_replied",
    "referral": "replied",
    "question": "replied",
    "ooo": "not_replied"
}

INTENT_TAG_MAP = {
    "interested": "#Interested",
    "form_request": "#FormRequest",
    "not_hiring": "#NotHiring",
    "not_interested": "#NotInterested",
    "referral": "#Referral",
    "question": "#Inquiry",
    "ooo": "#OutOfOffice"
}

def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()

class IntentClassifierModel:
    def __init__(self):
        self.pipeline = SkPipeline([
            ('tfidf', TfidfVectorizer(ngram_range=(1, 3), sublinear_tf=True, min_df=1)),
            ('clf', LogisticRegression(C=3.0, max_iter=300, solver='lbfgs'))
        ])
        self.is_trained = False

    def train(self, extra_data=None):
        data = list(TRAINING_DATA)
        if extra_data:
            data.extend(extra_data)

        X = [clean_text(text) for text, _ in data]
        y = [label for _, label in data]

        self.pipeline.fit(X, y)
        self.is_trained = True
        return len(data)

    def predict(self, text: str):
        if not self.is_trained:
            self.train()

        cleaned = clean_text(text)
        if not cleaned:
            return {
                "intent": "neutral",
                "confidence": 0.5,
                "recommended_stage": "replied",
                "recommended_tag": "#Reply"
            }

        probs = self.pipeline.predict_proba([cleaned])[0]
        classes = self.pipeline.classes_
        
        max_idx = probs.argmax()
        intent = classes[max_idx]
        confidence = float(probs[max_idx])

        # Rule heuristic overrides for clear outreach keywords
        if any(w in cleaned for w in ["fill this form", "fill out this form", "complete our form", "questionnaire", "intake form", "vendor portal", "procurement portal", "survey form", "vendor form", "fill in this form"]):
            intent = "form_request"
            confidence = 0.97
        elif any(w in cleaned for w in ["out of office", "vacation", "automated reply", "auto reply", "on leave", "out of office returning"]):
            intent = "ooo"
            confidence = 0.98
        elif any(w in cleaned for w in ["not hiring", "no open roles", "hiring freeze", "no vacancy", "full at this time", "fully staffed", "no open positions", "no headcount", "team is full"]):
            intent = "not_hiring"
            confidence = 0.96
        elif any(w in cleaned for w in ["not interested", "pass for now", "no thank you", "remove me", "no budget", "not a fit", "no bandwidth", "don't need external"]):
            intent = "not_interested"
            confidence = 0.94

        return {
            "intent": intent,
            "confidence": round(confidence, 3),
            "recommended_stage": INTENT_STAGE_MAP.get(intent, "replied"),
            "recommended_tag": INTENT_TAG_MAP.get(intent, "#Reply")
        }
