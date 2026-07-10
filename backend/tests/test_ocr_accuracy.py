import pytest
from app.services.ocr_service import OCRService


SAMPLE_RECEIPTS = [
    {
        "text": "WALMART\n123 Main St\nTotal: $45.67\nVisa: ****1234\nThank you!",
        "expected": {"amount": 45.67, "merchant": "WALMART"},
    },
    {
        "text": "AMAZON.COM\nOrder #123-456\n\nItems: $29.99\nShipping: $5.00\nTotal: $34.99",
        "expected": {"amount": 34.99, "merchant": "AMAZON.COM"},
    },
    {
        "text": "Due Date: July 15, 2026\nElectricity Bill\nAmount Due: ₹1,250.00\nAccount: 123456",
        "expected": {"amount": 1250.00, "due_date": "2026-07-15"},
    },
    {
        "text": "RESTAURANT BILL\nDate: 2026-07-10\nSubtotal: 18.00\nTax: 1.50\nTotal: 19.50",
        "expected": {"amount": 19.50},
    },
    {
        "text": "Payment Reminder\nFrom: Water Co.\nAmount: $85.00\nDue: 08/15/2026",
        "expected": {"amount": 85.00, "merchant": "Water Co.", "due_date": "2026-08-15"},
    },
    {
        "text": "Grocery store receipt with no clear total anywhere just some items and prices",
        "expected": {"amount": None, "merchant": "Grocery store receipt with no clear total anywhere just some items and prices"},
    },
]


class TestOCRAccuracy:
    def test_parses_amount(self):
        for case in SAMPLE_RECEIPTS:
            result = OCRService.parse_bill_text(case["text"])
            exp = case["expected"]
            if exp.get("amount") is not None:
                assert abs(result["amount"] - exp["amount"]) < 0.01, (
                    f"Failed for: {case['text'][:50]}... expected amount={exp['amount']}, got {result['amount']}"
                )
            elif "amount" in exp and exp["amount"] is None:
                assert result["amount"] is None, (
                    f"Expected None amount for: {case['text'][:50]}..., got {result['amount']}"
                )

    def test_parses_due_date(self):
        for case in SAMPLE_RECEIPTS:
            exp = case["expected"]
            if exp.get("due_date"):
                result = OCRService.parse_bill_text(case["text"])
                assert result["due_date"] == exp["due_date"], (
                    f"Failed for: {case['text'][:50]}... expected due_date={exp['due_date']}, got {result['due_date']}"
                )

    def test_parses_merchant(self):
        for case in SAMPLE_RECEIPTS:
            exp = case["expected"]
            if exp.get("merchant"):
                result = OCRService.parse_bill_text(case["text"])
                assert result["merchant"] is not None, (
                    f"Failed for: {case['text'][:50]}... expected merchant={exp['merchant']}, got None"
                )
                assert exp["merchant"].upper() in result["merchant"].upper() or result["merchant"].upper() in exp["merchant"].upper(), (
                    f"Failed for: {case['text'][:50]}... expected merchant contains {exp['merchant']}, got {result['merchant']}"
                )

    def test_returns_confidence(self):
        result = OCRService.parse_bill_text(SAMPLE_RECEIPTS[0]["text"])
        assert 0 <= result["confidence"] <= 1

    def test_confidence_higher_with_all_fields(self):
        full = OCRService.parse_bill_text(SAMPLE_RECEIPTS[2]["text"])
        empty = OCRService.parse_bill_text("")
        assert full["confidence"] >= empty["confidence"]

    def test_handles_empty_text(self):
        result = OCRService.parse_bill_text("")
        assert result["amount"] is None
        assert result["confidence"] == 0

    def test_handles_gibberish(self):
        result = OCRService.parse_bill_text("!@#$%^&*() asdf qwerty 123456")
        assert result["amount"] is None or result["confidence"] < 0.5
