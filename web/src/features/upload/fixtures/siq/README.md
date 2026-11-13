# Authored SIQ compatibility fixtures

These small XML files are original regression examples, not copied packages.

- `modern-secrets.xml`: SI `0c2167728f9eb66117b4c3576a05d91f9509cd8a` Question.Upgrade/ScriptsLibrary/StepParameter.ReadNumberSet; A18–A21, A30, A35. `secretOpenerPrice` is pinned to historical `8ca9ff06b05a88190fbdb0558ba701102c03ae3a`: choose price before transfer, unlike modern publicPrice.
- `legacy-secrets.xml`: the same Question.Upgrade and NumberSetTypeConverter; absent self is exceptCurrent, knows defaults after, legacy `[a;b]` means endpoints.
- `unresolved-script.xml`: P0 retention, not runtime script support. Default step is showContent. `isRef="True"` reflects C# bool.ToString(); source-only media must survive IndexedDB and `.oq`.

Separate SIQ themes are deliberately ignored. HTML and media 10-files/30-steps/5+ adaptation retain their existing policies.
