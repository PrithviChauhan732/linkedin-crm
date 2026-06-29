# Comprehensive dataset for training cold DM intent classifier

TRAINING_DATA = [
    # ── Interested ─────────────────────────────────────────────────────────────
    ("Sure, let's connect next week and discuss details.", "interested"),
    ("Sounds interesting! Can you send over a pitch deck or portfolio?", "interested"),
    ("I'm open to a quick 15 min call. Here is my calendar link.", "interested"),
    ("Thanks for reaching out! Let's schedule a time to chat.", "interested"),
    ("Would love to learn more about your services. When are you free?", "interested"),
    ("Hi Prithvi, yes we are actively looking for solutions like this.", "interested"),
    ("Great timing! Let's hop on a call tomorrow.", "interested"),
    ("Send me your email or calendly link please.", "interested"),
    ("I am interested. What does your onboard process look like?", "interested"),
    ("Yes, let's talk.", "interested"),
    ("Sure thing, let's set up a time.", "interested"),
    ("Happy to connect!", "interested"),
    ("This looks relevant. Let's set up a meeting.", "interested"),
    ("Please send over your available times for a demo.", "interested"),

    # ── Not Hiring ─────────────────────────────────────────────────────────────
    ("Thanks for reaching out, but we are not hiring right now.", "not_hiring"),
    ("We don't have any open roles at the moment.", "not_hiring"),
    ("Appreciate the note, but our engineering team is full.", "not_hiring"),
    ("Hi, unfortunately we have a hiring freeze currently.", "not_hiring"),
    ("We are not looking to add new headcount this quarter.", "not_hiring"),
    ("Sorry, we are not recruiting at this time.", "not_hiring"),
    ("Thanks, but we aren't hiring any contractors or full time staff.", "not_hiring"),
    ("We are full at this time with no vacancy.", "not_hiring"),
    ("No open vacancies right now.", "not_hiring"),
    ("Our team is fully staffed.", "not_hiring"),
    ("No headcount available for new roles.", "not_hiring"),
    ("We are currently at full capacity and not taking applications.", "not_hiring"),
    ("No job openings at present.", "not_hiring"),

    # ── Not Interested ─────────────────────────────────────────────────────────
    ("Thanks for the message, but we'll pass for now.", "not_interested"),
    ("Not interested at this moment. Good luck!", "not_interested"),
    ("We already have an in-house team handling this.", "not_interested"),
    ("No thank you.", "not_interested"),
    ("Please remove me from your list.", "not_interested"),
    ("We don't have budget for external vendors right now.", "not_interested"),
    ("Not a fit for our current roadmap.", "not_interested"),
    ("We are not interested in agency services.", "not_interested"),
    ("No bandwidth for new initiatives.", "not_interested"),
    ("We don't need external support for this.", "not_interested"),

    # ── Referral ───────────────────────────────────────────────────────────────
    ("You should reach out to Sarah, our VP of Marketing.", "referral"),
    ("I am not the right person for this. Please contact our CTO Dave.", "referral"),
    ("Forwarding your note to our recruiting coordinator.", "referral"),
    ("Please speak with John in operations.", "referral"),
    ("Try reaching out to team@company.com instead.", "referral"),
    ("Cc'ing Alex who manages our software partnerships.", "referral"),
    ("Contact our department head directly.", "referral"),

    # ── Question ───────────────────────────────────────────────────────────────
    ("What are your pricing tiers and contract terms?", "question"),
    ("Do you support integration with Salesforce and HubSpot?", "question"),
    ("Where are your case studies or past client results?", "question"),
    ("How does your tech compare to existing market tools?", "question"),
    ("What is your turnaround time for custom implementation?", "question"),
    ("Could you clarify how pricing works?", "question"),

    # ── Out of Office (OOO) ────────────────────────────────────────────────────
    ("I am out of the office on vacation until July 10th.", "ooo"),
    ("Automated Reply: I will have limited access to messages.", "ooo"),
    ("On parental leave until next month. Will reply upon return.", "ooo"),
    ("Traveling for conference with delayed responses.", "ooo"),
    ("Out of office returning next week.", "ooo"),
]
