"""
WarmDM Dataset Parser & Tagging Engine
Parses raw prospect messages, auto-tags them with WarmDM standard tags,
and generates formatted training datasets for model training.
"""

import json
import re

TAG_TO_INTENT = {
    "#Interested": "interested",
    "#FormRequest": "form_request",
    "#NotHiring": "not_hiring",
    "#NotInterested": "not_interested",
    "#Referral": "referral",
    "#Inquiry": "question",
    "#OutOfOffice": "ooo",
}

INTENT_TO_TAG = {v: k for k, v in TAG_TO_INTENT.items()}

def auto_tag_message(text: str) -> str:
    """Parses raw text and assigns WarmDM standard tag based on NLP pattern matching."""
    clean = text.lower().strip()
    
    if any(w in clean for w in ["fill this form", "fill out", "form link", "questionnaire", "intake form", "portal", "survey form"]):
        return "#FormRequest"
    elif any(w in clean for w in ["not hiring", "no open roles", "hiring freeze", "no vacancy", "full at this time", "fully staffed", "no open positions"]):
        return "#NotHiring"
    elif any(w in clean for w in ["not interested", "pass for now", "no thank you", "remove me", "no budget", "not a fit"]):
        return "#NotInterested"
    elif any(w in clean for w in ["reach out to", "contact", "speak with", "forwarding", "cto", "vp of"]):
        return "#Referral"
    elif any(w in clean for w in ["out of office", "vacation", "leave", "automated reply", "auto reply"]):
        return "#OutOfOffice"
    elif any(w in clean for w in ["pricing", "rates", "cost", "how does", "what is", "case studies"]):
        return "#Inquiry"
    elif any(w in clean for w in ["sure", "let's talk", "schedule", "interested", "connect", "call"]):
        return "#Interested"
    else:
        return "#NotInterested"

def parse_and_export_dataset(raw_messages_list):
    """Parses a list of raw messages, tags them, and formats them for dataset.py"""
    parsed_data = []
    print(f"[Dataset Parser] Parsing and tagging {len(raw_messages_list)} raw outreach messages...")
    
    for msg in raw_messages_list:
        tag = auto_tag_message(msg)
        intent = TAG_TO_INTENT[tag]
        parsed_data.append((msg, intent, tag))
    
    print("✅ Dataset Parsing & Tagging Summary:")
    tag_counts = {}
    for _, _, tag in parsed_data:
        tag_counts[tag] = tag_counts.get(tag, 0) + 1
    for tag, count in tag_counts.items():
        print(f"   🏷️  {tag}: {count} messages")
        
    return [(msg, intent) for msg, intent, _ in parsed_data]

if __name__ == "__main__":
    sample_raw_inbox = [
        "Please fill out our vendor registration form at this link",
        "We are full at this time with zero vacancies open",
        "Sure thing, let's schedule a call tomorrow afternoon",
        "Not interested right now, please take me off your list",
        "Contact Sarah in marketing directly",
        "What is your pricing model for enterprise teams?",
        "Out of office on vacation until next Monday"
    ]
    parse_and_export_dataset(sample_raw_inbox)
