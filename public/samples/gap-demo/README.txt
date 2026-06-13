NorthBridge gap demo — sample response files
================================================

Upload each file on the matching Gap analysis row (demo workbook).

File                                      | Gap rule(s)     | Document slot                      | Expected result
------------------------------------------|-----------------|------------------------------------|------------------
Packaging_Spec.pdf                        | RULE_001        | Packaging_Spec.pdf                 | 94% — clears gap
Packaging_Spec_DRAFT.pdf                  | RULE_001        | Packaging_Spec.pdf                 | 71% — partial, gap open
DV_PV_Test_Standard.pdf                   | RULE_002        | DV_PV_Test_Standard.pdf            | 95% — clears DV/PV test gap
DV_PV_Test_Standard_DRAFT.pdf             | RULE_002        | DV_PV_Test_Standard.pdf            | 73% — partial
NB-QA-118_Customer_Spec.pdf              | RULE_028        | NB-QA-118_Customer_Spec.pdf        | 92% — clears NB-QA-118 gap
Appearance_Sample_Approval_Gate.pdf       | RULE_027        | Appearance_Sample_Approval_Gate.pdf| 91% — clears gap

After upload: use Finalize to lock the file to the gap, or Remove to revert.

Regenerate PDFs: npm run sample-gap-demo
