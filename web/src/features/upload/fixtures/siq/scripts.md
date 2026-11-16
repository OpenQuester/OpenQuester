# Script fixtures

Small original fixtures characterize SI `ScriptsLibrary`, `QuestionEngine`,
`StepParameter`, and `QuestionPlayHandler` at
`VladimirKhil/SI@0c2167728f9eb66117b4c3576a05d91f9509cd8a`.

`script-two-asks.xml` covers A24/A35: current-question parameter reference with
case-insensitive `True`, inline content, per-ask duration, two numeric outcomes,
`right` fallback, and the accepted `setTheme` no-op. The cell theme remains.

The historical runtime implements `setPrice/noRisk` at
`50d84a6098cd55fcf1adfbe41b4e17cfef6acfb1` (right × 2, wrong 0).
At `0f4986d24eed4a2efb5f0002c1b9cc58400d5162` the factor and penalty are room
settings with the same defaults. That revision's button and all-play templates
also execute `setPrice/withButton` and `setPrice/forAll`, which can zero the
wrong price. `4c2403abbe1ed57ba7a0b8b6469894de55cf5385` removes those steps.
`setPrice/forYourself` was reserved. OQ maps the historical button and all-play
steps to its room wrong-answer penalty. The modern `multiply` step multiplies
the current amount with the existing OQ factor 2 and preserves the wrong-answer
policy already in force.
