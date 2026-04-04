RFQ Assistant Agent - Test Pack

Purpose
-------
This pack provides representative test files for validating an internal RFQ review assistant for supplier quotation workflows.

Contents
--------
1. current_rfq_case_A_nominal
   - Complete package for parser and low-risk review tests.
2. current_rfq_case_B_missing_files
   - Incomplete package to test completeness checks and blocking gaps.
3. current_rfq_case_C_high_risk
   - Complete but high-risk package to stress gap rules and benchmark logic.
4. historical_data
   - Historical RFQ submissions and issue history for similarity and benchmark testing.
5. database
   - SQL schema and seed data for a development or QA environment.
6. api_samples
   - Example request/response payloads for parser and gap-analysis services.
7. test_oracles
   - Expected rules, acceptance matrix, and rule catalog for regression testing.

Suggested Test Flow
-------------------
- Load database/01_schema.sql and database/02_seed_data.sql into a QA database.
- Parse each current RFQ case and compare against api_samples/parser_response_case_*_expected.json.
- Run gap analysis for Case B and Case C and compare to the expected gap responses.
- Use Historical_RFQ_Submissions.xlsx and Parsed_Historical_RFQs.jsonl as historical context.
- Use Acceptance_Test_Matrix.xlsx as the top-level QA checklist.

Notes
-----
- Files are synthetic and created for internal testing only.
- Units are metric where specified.
- The pack intentionally includes one incomplete case and one high-risk case.
