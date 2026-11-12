# План підтримки типів і комбінацій SIGame та виправлення SIQ-імпорту

Дата: 2026-11-10. **Поетапна реалізація. P0–P6 інтегровано.**

Цей етап поєднує visible/real price foundations, normal-for-all, stakeAll import,
point import/geometry та незалежний select. P2 candidate2 зберігає source right
labels після публікації, обмежує duration reports авторським контентом і дозволяє
select одразу після buzz у single noRisk. P0 зберігає діагностику ремонту в
чернетці та `.oq`, а P4 додає правила вибору одержувача, ціни й award для secret.
P5 зберігає авторські кроки показу та час відповіді, додає підготовку медіа для
прямих stake/secret і приватний показ реплік ведучому. У P0–P4 сценарій
реального імпорту й публікації SIQ select пройшов на desktop, tablet і phone.
P6 додає типізовані SIQ-програми, окремий таймер для кожного `askAnswer`,
проєкцію поточного кроку для кожної ролі та підготовку медіа поточних варіантів.
Загальна transport, live browser і migration перевірка P7 триває. Докази й межі
перевірки наведено в handoff.

База OpenQuester: `6af8784e2d443fb251e4c6e61f51744f9f918c15`.
Досліджена база SI: `0c2167728f9eb66117b4c3576a05d91f9509cd8a`.
Номери рядків нижче прив'язані до цієї бази; перед реалізацією перевіряти названі символи.
Фрагменти TypeScript — **шаблони запропонованої реалізації**, а не код, який уже є в проєкті.
Нові назви полів і файлів у цьому документі є пропозиціями.

## 1. Мета та незмінні рішення

Підтримати відсутні не-HTML типи та їхні комбінації: імпорт → чернетка → `.oq`
→ публікація → серверна гра → reconnect → показ відповіді → локальний playtest.
Зокрема додати звичайне питання для всіх, правильно імпортувати `stakeAll`, вибір
варіантів у спеціальних питаннях і відповідь кліком на правильному зображенні.

Обов'язково зберегти:

- Наші типи `simple`, `stake`, `secret`, `noRisk`, `hidden`, `choice` і вже опубліковані пакети.
- Наші різновиди «ставка для всіх» та «без ризику для всіх», їхні формули й поточні дефолти.
- Нашу геометрію, редактор радіуса й legacy-поведінку точок у власних OQ-питаннях.
- Тему клітинки: окрему фактичну тему SIGame свідомо ігноруємо. Вона не потребує
  нового поля, прихованого announcement, UI або repair-повідомлення.
- Розділення цін: `price` — номінал для табло; optional `realPrice` — фактична ціна.
  Доступ до них централізований через getVisiblePrice()/getRealPrice(), без розсипаних fallback.
- Наш дизайн медіа: 5+ одночасних візуальних елементів адаптуються послідовно;
  максимум 10 файлових входжень у групі та 30 контентних кроків окремо в питанні й відповіді.
  Це прийняті продуктові правила, **не дефекти цього плану**. Не підвищувати ліміти.
- Явну заборону HTML, поточний preflight і згоду на видалення HTML-питань.
  **Не додавати HTML renderer, iframe, JavaScript, sandbox, клієнтські мініігри або обхід заборони.**
- `GameActionExecutor`, серіалізацію дій, рольові перевірки, score clamps,
  таймери, приховані відповіді/ставки, media ACK і поточний question opening.

Це не завдання на заміну всієї архітектури гри чи на переписування редактора.
Додавати відсутні правила до чинних власників. Не створювати паралельний імпортер,
окрему копію гри для SIQ або новий сервіс заради кожного типу.

`price=-1` означає неактивну клітинку, а не особливий тип питання. Звичайну порожню
клітинку імпортер уже відкидає. У цьому плані це лише перевірка збереження поведінки;
окремого «виправлення типу -1» немає.

## 2. Доказова база і точки входу

Поточна реалізація — джерело фактичної поведінки. Матриця сумісності містить також
цільові статуси, тому напис `Supported` у ній не замінює перевірку коду.

| Ділянка | Поточний код і символ | Встановлений факт / майбутня зміна |
|---|---|---|
| SIQ типи | `web/src/features/upload/siq.ts:72`, `TYPE_ALIASES`; `:191`, `question` | Назва мапиться окремо від параметрів; невідомий тип стає `simple` |
| Відповіді SIQ | `web/src/features/upload/siq.ts:243`, `:281`, `readV5` | Читаються `number`, `point`; `select`, options, script і answerDuration не переносяться |
| Старий формат | `web/src/features/upload/siq.ts:344`, `readV4` | Медіа розділяються marker; старі параметри кота не переносяться |
| Модель імпорту | `web/src/features/upload/types.ts`, `UploadQuestion`, `ImportWarning` | Нові поля мають проходити через цей boundary |
| Власний архів | `web/src/features/upload/oq.ts`; `web/src/features/package-editor/packageMedia.ts`, `exportOq` | Не втратити нові поля при повторному відкритті `.oq` |
| Чернетка | `web/src/features/package-editor/packageDraft.ts`, `fromUpload`, `toUploadQuestion`, `draftPointImage` | Зараз `forEveryone` серіалізується тільки для stake/noRisk; legacy point бере перше зображення |
| UI типів | `web/src/features/package-editor/question-form/QuestionTypeSettings.tsx:21`, `:38`, `AnswerModeField` | Немає звичайного «для всіх»; способи відповіді text/number/point |
| Публікація | `web/src/features/package-editor/validatePackage.ts`; `numericAnswer.ts` | Узгодити правила нових комбінацій і бонусу без тіла |
| Серверні контракти | `server/src/domain/types/dto/package/PackageQuestionDTO.ts`; `enums/package/AnswerType.ts` | Додати select і необов'язкові метадані, зберегти старі поля |
| Ціна й scoring | `server/src/domain/logic/question/QuestionValueLogic.ts`; `web/src/game/selectors.ts`, `questionValue` | Зараз беруть question.price; замінити на централізований доступ до фактичної ціни |
| Валідація | `server/src/presentation/schemes/package/packageSchemes.ts:108` | `simple + forEveryone` заборонено; options дозволені тільки type=choice, 2–8 |
| Збереження | `server/src/infrastructure/database/models/package/PackageQuestion.ts`; `repositories/PackageRepository.ts:366`, `:488` | Нові поля проводити import/toDTO/replacement; answers уже зберігаються окремими записами |
| Публічне питання | `server/src/domain/mappers/GameQuestionMapper.ts`, `mapToSimpleQuestion` | Не віддати correctChoiceOrder, target, секретні репліки або майбутню відповідь гравцям |
| Для всіх | `server/src/domain/logic/question/AllPlayLogic.ts:28`, `:206`; `types/dto/game/state/AllPlayDataDTO.ts` | Лише stake/noRisk; немає формули +price/−price без ставок |
| All-play actions | `server/src/application/usecases/question/EveryoneAnswerUseCases.ts` | Зберегти executor, advanceIfDone, приватність і статистику |
| Вибір варіанта | `server/src/domain/logic/question/ChoiceSelectionLogic.ts`; `ChoiceAnswerLogic.ts`; `application/usecases/question/AnswerSubmittedUseCase.ts` | Перевірки прив'язані до type=choice; explicit selection заборонений у all-play/final |
| Точка | `web/src/lib/pointImage.ts`; `upload/pointImageDimensions.ts`; `server/src/domain/logic/question/PointImageLogic.ts` | Без pointImageOrder вибирається перша картинка |
| Перевірка точки | `server/src/domain/logic/question/AnswerCheckLogic.ts:71`; `web/src/features/package-editor/playtest/checkPreviewAnswer.ts` | Власна метрика OQ відрізняється від SIGame |
| Секрет | `server/src/application/services/question/SecretQuestionService.ts`; `domain/validators/SecretQuestionValidator.ts` | Вибір зі списку allowedPrices тільки отримувачем після передачі |
| Контент і час | `server/src/domain/logic/question/QuestionContentPlanLogic.ts`; `authoredContentGroups.ts` | Зберегти наш медіадизайн; час тексту зараз обчислюється замість авторського duration |
| Гра у браузері | `web/src/features/game/play/question/`; `dock/allPlayModels.ts`; `AllPlayStages.tsx` | Показ, input, CTA й scoring залежать від чинних типів/режимів |
| Локальний playtest | `web/src/features/package-editor/playtest/previewRuntime.ts`, `previewSpecial.ts`, `checkPreviewAnswer.ts`, `preparePreview.ts` | Перенести всі нові правила, а не лише preview-картку |
| Контракти браузера | `openapi/schema.json`; `web/src/api/schema.d.ts`; `web/src/game/protocol.ts` | REST генерується; socket-типи підтримуються окремо |

Первинні джерела SI, на яких ґрунтується план:

- [QuestionTypes](https://github.com/VladimirKhil/SI/blob/0c2167728f9eb66117b4c3576a05d91f9509cd8a/src/Common/SIPackages/Core/QuestionTypes.cs),
  [ScriptsLibrary](https://github.com/VladimirKhil/SI/blob/0c2167728f9eb66117b4c3576a05d91f9509cd8a/src/Common/SIPackages/ScriptsLibrary.cs).
- [QuestionEngine](https://github.com/VladimirKhil/SI/blob/0c2167728f9eb66117b4c3576a05d91f9509cd8a/src/Common/SIEngine.Core/QuestionEngine.cs):
  спосіб відповіді встановлюється незалежно від механіки питання; select використовує перший item кожного option.
- [Question.Upgrade](https://github.com/VladimirKhil/SI/blob/0c2167728f9eb66117b4c3576a05d91f9509cd8a/src/Common/SIPackages/Question.cs#L306):
  cat/bagcat, self/knows, ціна, тема, marker.
- [RulesSettings](https://github.com/VladimirKhil/SI/blob/0c2167728f9eb66117b4c3576a05d91f9509cd8a/src/SICore/SI.Contracts/RulesSettings.cs#L18):
  стандартний forAll має штраф; noRisk — іншу політику; це налаштування гри, не дані конкретного SIQ.
- [PointAnswerViewModel](https://github.com/VladimirKhil/SI/blob/0c2167728f9eb66117b4c3576a05d91f9509cd8a/src/SIQuester/SIQuester.ViewModel/PointAnswerViewModel.cs#L109),
  [SelectPointView](https://github.com/VladimirKhil/SI/blob/0c2167728f9eb66117b4c3576a05d91f9509cd8a/src/SIQuester/SIQuester/View/Dialogs/SelectPointView.xaml.cs#L115),
  [AnswerChecker](https://github.com/VladimirKhil/SI/blob/0c2167728f9eb66117b4c3576a05d91f9509cd8a/src/SICore/SICore/Clients/Other/AI/AnswerChecker.cs#L45).
- [SICore InformAnswerOption](https://github.com/VladimirKhil/SI/blob/0c2167728f9eb66117b4c3576a05d91f9509cd8a/src/SICore/SICore/Clients/Game/GameController.cs#L5015):
  options можуть містити не лише text/image, а й інший підтримуваний media content. HTML усе одно виключений у нас.
- Історичні [secretOpenerPrice](https://github.com/VladimirKhil/SI/blob/8ca9ff06b05a88190fbdb0558ba701102c03ae3a/src/Common/SIPackages/ScriptsLibrary.cs)
  і [видалення константи choice](https://github.com/VladimirKhil/SI/commit/f3df96cd85681b7002bb02edf5029d17c0dac71e).
  Наявність старої/зарезервованої назви сама по собі не доводить повний робочий сценарій.

## 3. Цільова модель: механіка, участь і формат відповіді

Не множити top-level типи на `stakeWithPicturesForEveryone` тощо.
Розширити чинні поля, не перейменовуючи власні типи:

Уточнення користувача: **відомі тема/ціна і бонус після передачі — різновиди
наявного secret, а не нові top-level типи**. Чинний SecretStage вже показує тему
та ціну клітинки до передачі (`web/src/features/game/play/SpecialStages.tsx:17`).
Цю поведінку власних OQ-питань зберігаємо. Окрему спеціальну тему SIGame
**ігноруємо за рішенням користувача**; всюди лишається тема клітинки. Підтримуємо
відмінну фактичну ціну через realPrice і правильний момент її розкриття.
Не називати відому тему/ціну відсутньою механікою й не додавати тип лише через назву теми.

| Вісь | Представлення |
|---|---|
| Механіка | Чинний `type`: simple/stake/secret/noRisk/hidden/choice |
| Участь | Чинний `subType=forEveryone` для simple/stake/noRisk; legacy choice також може використовувати цю ознаку |
| Формат відповіді | `answerType=text/number/point/select`; legacy `type=choice` означає select навіть без нового поля |
| Ціна | `price` + optional `realPrice`; getVisiblePrice()/getRealPrice() відокремлюють табло від нарахування |
| Правила секрету | Новий необов'язковий `secretRules`, тільки для type=secret |
| Імпортована геометрія точки | Нові необов'язкові метадані в JSON `answerPoint`; native OQ-поля залишаються чинними |
| Власний сценарій | Нормалізований typed script лише там, де неможлива точна конвертація в перелічені поля |

Рекомендований сумісний helper, окремо біля server/domain і web/game, без нового shared package:

```ts
// Шаблон. AnswerType.SELECT потрібно додати до enum до інтеграції.
type AnswerFormat = "text" | "number" | "point" | "select";

function answerFormat(question: {
  type: string;
  answerType?: AnswerFormat | null;
}): AnswerFormat {
  return question.type === "choice" ? "select" : (question.answerType ?? "text");
}
```

Використати цей predicate у checking, UI, timers/options reveal, reveal результату,
media preloading, editor validation та playtest. Не замінювати механічно кожне
`type === choice`: scoring/buzzer залишаються властивостями механіки, а не форми input.

Матриця обов'язкових комбінацій:

| Механіка SI | OQ-модель | text | number | point | select |
|---|---|---|---|---|---|
| simple/withButton | simple | ✓ | ✓ | ✓ | ✓ |
| stake/auction | stake + simple | ✓ | ✓ | ✓ | ✓ |
| stakeAll | stake + forEveryone | ✓ | ✓ | ✓ | ✓ |
| forAll | simple + forEveryone | ✓ | ✓ | ✓ | ✓ |
| noRisk/forYourself/sponsored | noRisk + simple | ✓ | ✓ | ✓ | ✓ |
| secret/cat/bagcat | secret + secretRules | ✓ | ✓ | ✓ | ✓ |
| secretPublicPrice | secret + priceAnnouncement beforeTransfer | ✓ | ✓ | ✓ | ✓ |
| secretNoQuestion | secret + outcome award | — | — | — | — |
| фінал з успадкованим типом | наявний final flow | ✓ | ✓ | ✓ | ✓ |

Власні noRisk+forEveryone та choice зберігаються. `hidden` не видаляється і має
працювати з новим select input там, де це звичайна механіка з прихованою ціною.
Одночасно «передати одному» й «відповідають усі» не є довільним checkbox-комбо:
це можливе лише як явні різні кроки власного сценарію, з визначеною семантикою.

### 3.1. Видима й фактична ціна: єдиний контракт доступу

Остаточне рішення користувача для цього плану:

- `price` — видимий номінал клітинки. Передача секрету, вибір суми або розкриття
  не перезаписують це поле й не змінюють суму на табло.
- `realPrice?: number | null` — фактична базова ціна питання, якщо відрізняється
  від номіналу. Відсутнє/null означає використати price; явний 0 — саме 0.
- `getVisiblePrice()` повертає price; `getRealPrice()` повертає realPrice ?? price.
  Це accessors значення; їх виклик сам по собі не розкриває ціну й не дозволяє scoring.
- Нерозв'язаний діапазон — окремий стан вибору ціни. До його завершення scoring
  заборонений, навіть якщо fallback getter уже може повернути номінал.

У runtime переважають plain DTO, а не екземпляри PackageQuestion. Тому не потрібно
масово міняти DTO на класи або серіалізувати методи в Redis/Socket.IO. Додати методи
на наявній entity PackageQuestion, а для DTO використати невеликі спільні доменні
функції з тією ж семантикою. Методи делегують цим функціям, без другої формули.
У браузері — відповідні helpers біля game/; окремий wrapper/factory/shared package не потрібен.

```ts
// Шаблон нового domain helper questionPrices.ts, не нової моделі питання.
interface QuestionPriceFields {
  price: number | null;
  realPrice?: number | null;
}

function getVisiblePrice(question: QuestionPriceFields): number | null {
  return question.price;
}

function getRealPrice(question: QuestionPriceFields): number | null {
  return question.realPrice ?? question.price;
}
```

```ts
// Фрагмент майбутніх методів у ВЖЕ НАЯВНІЙ entity PackageQuestion.
// Декоратори/інші поля опущено. Helpers імпортуються з domain, як у фрагменті вище.
class PackageQuestion {
  price!: number | null;
  realPrice?: number | null; // nullable int column real_price

  public getVisiblePrice(): number | null {
    return getVisiblePrice(this);
  }

  public getRealPrice(): number | null {
    return getRealPrice(this);
  }
}
```

Місця використання визначати за змістом, а не глобальною заміною `.price`:

| Споживач | Яке значення використовує |
|---|---|
| Board cell, question-pick animation, номінал у списку/історії клітинок | getVisiblePrice(); для нашого hidden лишається чинна політика приховування |
| Подія/екран розкриття фактичної суми | getRealPrice() після дозволеного кроку announcement |
| Звичайне питання, normal-for-all, секрет, bonus award | getRealPrice() після resolution/reveal; один і той самий snapshot для right/wrong |
| noRisk і noRisk-for-all | getRealPrice() × чинний multiplier; неправильна відповідь як зараз 0 |
| Одиночна ставка / stake-for-all / фінал | Виграшна/особиста ставка має пріоритет; getter дає лише базову ціну там, де вона потрібна правилам |
| RoundExtremes для SIQ cost=0 | Номінальні getVisiblePrice() playable клітинок, як source round prices; це явний edge case |
| Мінімум ставки, default bet, maxStakeFor, give-up/timeout penalties | Явно перевірити формулу типу; базову фактичну ціну брати через getRealPrice(), а використання номіналу окремо обґрунтувати й покрити тестом |
| Score history, result/review, статистика й preview | Та сама resolved фактична сума/ставка, що на authoritative server; не номінал табло |

Приклад: `price=100`, `realPrice=500`. На табло лишається 100; у дозволений момент
оголошується 500; правильна/неправильна відповідь секрету дає +500/−500.
Бонус після передачі дає +500 без запиту відповіді. `price=100, realPrice=0`
дає 0, а не 100. Для native OQ з realPrice=null поведінка повністю зберігається.

Авторську fixed SIQ ціну зберігати в question.realPrice. Результат вибору з діапазону
зберігати в **поточному ігровому питанні**, не в cached/persisted пакеті: інакше одна
гра змінить ціну для іншої. Не перезаписувати authored price чи робити backfill старих пакетів.
Нинішню мутацію `currentQuestion.price = payload.price` у SecretTransferToAnsweringHandler
замінити на встановлення realPrice; так само прибрати `{ ...question, price }` у SecretQuestionService.

До announcement public DTO не містить прихованого realPrice; public board завжди
отримує номінал. Після розкриття realPrice дозволений у поточному question view/event
і зберігається в reconnect snapshot. Внутрішній getRealPrice() до reveal може
використовуватися для серверної валідації, але не для публічного broadcast чи передчасного judge.
SimplePackageQuestionDTO/Omit і mapToSimpleQuestion мають явно врахувати це поле,
щоб додавання optional field не стало витоком через spread чи структурну типізацію.

Провести semantic-аудит `.price` у всіх owning paths, включно з:
QuestionValueLogic, AllPlayLogic, AnsweringToShowingHandler, StakeQuestionService,
ChoosingToStakeBiddingHandler, SecretTransferToAnsweringHandler, server validators,
GameQuestionMapper, web selectors.questionValue/stakeInfo, useQuestionStage,
SpecialStages, board, previewRuntime/previewSpecial і `.oq`/package replacement.
Прямий доступ допустимий у serialization/accessors і явно табличній структурі;
бізнес-формули й reveal не повинні дублювати `realPrice ?? price` по всьому коду.

## 4. Порядок робіт і залежності

| Етап | Результат | Залежність / умова завершення |
|---|---|---|
| P0 | Постійні SIQ fixtures, characterization і compatibility diagnostics | Спочатку зафіксувати фактичні поломки; HTML та наші ліміти не змінюються |
| P1 | Цінові accessors/контракт, звичайне питання для всіх + stakeAll import | Новий режим all-play працює через existing executor; формули використовують resolved real price |
| P2 | Незалежний select, усі комбінації й exact option identity | Після контрактів; включає all-play/final input та приватність |
| P3 | Коректний point import, target occurrence і метрика | Може виконуватися незалежно від P1/P2; не змінює native OQ геометрію |
| P4 | Legacy upgrade, aliases, secretRules, діапазони й бонус | Після P1/P2, щоб formats не губилися під час нормалізації секрету |
| P5 | Власний час, текст відповіді, репліки, authored timing | Сумісний контентний шлях зі збереженням 10/30 і 5+ політики |
| P6 | Структуровані не-HTML scripts та нестандартні комбінації | Стандартні сценарії спочатку компілюються в P1–P5; решта виконується server-side |
| P7 | Наскрізна перевірка, migration/round-trip/reconnect і оновлення specs | Жодного «повністю підтримано» лише за зеленим parser test |

Кожний етап — придатна до окремого review зміна. На проміжних етапах нерозв'язана
особливість має чесну critical-діагностику, а не успішний імпорт зі знищенням семантики.
P6 не можна викреслити й одночасно оголосити повну підтримку не-HTML сценаріїв.

## 5. P0 — fixtures і діагностика без тихого fallback

Постійні fixtures додати поруч із `web/src/features/upload/parse.test.ts`
(пропозиція: новий `web/src/features/upload/fixtures/siq/`). Маленькі авторські XML
і тестові зображення тримати в репозиторії, не прив'язувати тести до приватної `.codex/tmp`.
При перенесенні upstream fixture зберегти attribution і зафіксований revision.

Потрібні приклади: normal-for-all, stake-all, select з міткою C, select з однаковими
текстами/зображеннями, stake+select, secret+select, forAll+select, точки x,y та x,y,a,
дві різні картинки і два входження одного hash, legacy bagcat, bonus без тіла,
custom inline script і script із parameter reference, answerDuration.

Розширити існуючий import report, а не додавати паралельний toast-канал:

```ts
// Пропозиція local draft/archive metadata, не поточний REST DTO.
interface SiqCompatibilityIssue {
  code: string;
  severity: "info" | "warning" | "critical";
  source: { round: number; theme: number; question: number; parameter?: string };
  feature: string;
  resolution: "converted" | "needsRepair";
}
```

- Імпортованій сутності дати стабільний draft id та зв'язок із source coordinates;
  індекс теми/ціна недостатні після переміщення питання.
- Чернетку та `.oq` дозволити зберегти з unresolved source data у bounded typed form;
  publication і playtest блокувати critical-issues. HTML source через це не зберігати.
- Невідомий тип/операція не повинні автоматично ставати simple. Якщо простий fallback
  потрібен автору — тільки явна дія «Перетворити на звичайне», з описом втрат.
- `emptyQuestion` застосовувати після визначення механіки: для award-секрету тіло
  не потрібне; для усного питання потрібна репліка ведучого; script може мати inline body.
- Існуючі `ImportWarnings`, health panel, storage/autosave та i18n en/uk/ru розширюються
  в межах своїх власників. Новий report не є підставою переписати draft store.

## 6. P1 — звичайне питання для всіх

Додати `AllPlayMode.SIMPLE = "simple"`. В API дозволити `forEveryone` для simple
і сумісного legacy choice; у редакторі показати checkbox «Відповідають усі» з
поясненням виграшу/штрафу. Для normal-for-all немає етапу BIDDING.

Формули фіксуються в all-play state на старті питання після resolution ціни.
У таблиці нижче `price` означає resolved getRealPrice(), а номінал для табло
залишається у самому питанні й читається через getVisiblePrice().

| Режим | Правильно | Неправильно / немає відповіді |
|---|---|---|
| simple | +price | −price за wrongAnswerPenalty=subtract, інакше 0 |
| stake | +stake | −stake, як зараз |
| noRisk | +price × multiplier | 0, як зараз |

У SIGame штраф forAll є налаштуванням кімнати й за замовчуванням увімкнений.
Не вигадувати це значення з SIQ. У нас normal-for-all використовує чинне
`game.settings.wrongAnswerPenalty` (`subtract` / `none`), дефолт subtract;
noRisk-for-all зберігає свою безштрафну поведінку. Якщо налаштування змінюють під час
питання, поточний snapshot правил не перераховує вже прийняті результати.

```ts
// Шаблон доменної функції: жодного I/O або emit.
type EveryoneScoring = {
  mode: "simple" | "stake" | "noRisk";
  price: number; // Snapshot getRealPrice(), не номінал клітинки.
  priceMultiplier: number | null;
  wrongAnswerPenalty?: "subtract" | "none";
};

function everyoneDelta(
  data: EveryoneScoring,
  stake: number | null,
  correct: boolean,
): number {
  if (data.mode === "stake") return correct ? (stake ?? data.price) : -(stake ?? data.price);
  if (data.mode === "noRisk")
    return correct ? Math.round(data.price * (data.priceMultiplier ?? 1)) : 0;
  return correct ? data.price : data.wrongAnswerPenalty === "none" ? 0 : -data.price;
}
```

Інтеграційні точки:

1. `AllPlayLogic.modeOf`, `scoreChange`, snapshot data, mapper start event;
   нормальний режим запускається в `ChoosingToMediaDownloadingHandler`, без bidding.
   Snapshot scoring price береться через getRealPrice(); не підміняти ним board price.
2. `MediaDownloadingToShowingHandler`, `ShowingToAllPlayReviewingHandler`,
   `AllPlayReviewingToShowingAnswerHandler`, `EveryoneAnswerUseCases`:
   ті самі eligibility, auto-review, one accepted answer, статистика, score clamp.
3. `GameStateDTO`/snapshot filters, `AllPlayEventPayloads.ts`, `web/src/game/protocol.ts`,
   reducer/selectors, `AllPlayStages.tsx`, `dock/allPlayModels.ts` і playtest.
4. Окремий текст правила для normal-for-all: «Усі відповідають. +100 / −100» або
   «+100 / без списання». Spectator бачить очікування; showman — review;
   сторонні відповіді до review не показуються.
5. Пакетні DTO/схема, DraftQuestion.forEveryone, `toUploadQuestion`, `.oq` reader/export,
   картка питання і preview не повинні губити прапорець.

Початкове мапування імпортера після підтримки нового контракту:

```ts
// Шаблон частини normalizeSiqQuestionKind, не повний parser.
function everyoneKind(rawType: string) {
  if (rawType === "forAll") return { type: "simple", subType: "forEveryone" } as const;
  if (rawType === "stakeAll") return { type: "stake", subType: "forEveryone", maxPrice: null } as const;
  return null;
}
```

Не зупинятися на додаванні двох рядків у TYPE_ALIASES: там неможливо відобразити
subType, штраф і відсутність bidding у звичайного питання для всіх.

## 7. P2 — select незалежно від механіки

### 7.1. Контракт і сталі ідентичності

Додати `AnswerType.SELECT`, дозволити наявні `answers`, `correctChoiceOrder`,
`showDelay` для `answerFormat(q) === select`, а не лише type=choice.
`type=choice` продовжує працювати без конвертації старих пакетів.
Для SIQ мітки A/B/C — це ідентичності, а не тексти варіантів.

Пропозиція: необов'язкове `sourceLabel` на option для відображення й round-trip;
сервер приймає лише перевірений `choiceOrder` як selection identity.
Ключ правильної відповіді визначати за **унікальною міткою**, навіть якщо тексти,
hash або зображення збігаються. Невідома/дубльована мітка — critical needsRepair,
а не вгадування першого збігу. Власні legacy text aliases не видаляти.
Для SIQ select еталоном є перший right label, як у source runtime. Додаткові source
right зберегти для round-trip, але не передавати сирі A/B/C у наші текстові aliases:
це могло б помилково дозволити іншу option, текст якої випадково дорівнює мітці.

```xml
<question price="300" type="stake">
  <params>
    <param name="question" type="content"><item>Оберіть місто</item></param>
    <param name="answerType">select</param>
    <param name="answerOptions" type="group">
      <param name="A" type="content"><item>Київ</item></param>
      <param name="B" type="content"><item>Львів</item></param>
      <param name="C" type="content"><item>Одеса</item></param>
    </param>
  </params>
  <right><answer>C</answer></right>
</question>
```

Результат: `type=stake`, `subType=simple`, `answerType=select`, три options,
`correctChoiceOrder=2`. На екрані правильної відповіді показати «Одеса»,
за потреби з міткою C; не просто «C».

```ts
// Шаблон exact label mapping; media reading і діагностика додаються в SiqReader.
type LabeledOption = { order: number; sourceLabel: string };

function correctOptionOrder(options: LabeledOption[], rightLabel: string): number | null {
  const matches = options.filter((option) => option.sourceLabel === rightLabel.trim());
  return matches.length === 1 ? matches[0]!.order : null;
}
```

Перший content item option трактувати як SIEngine; подальші item не складати
довільно в нову відповідь. Text/image/audio/video — через чинний media registry,
hash, preload та controls. Для audio/video option розділити програвання і вибір
кнопками; preview медіа не надсилає відповідь. HTML у будь-якому option лишається забороненим.

Поточне `.max(8)` для кількості options і UI-припущення 2–8 — окрема перевірена
перешкода для імпорту. Не обрізати список до 8. У межах цього етапу прибрати
довільне обмеження 8 з semantic validator; залишити загальні обмеження розміру
безпечного імпорту. Перевірити щонайменше 9 і 30 options. Наші 10 файлів/30 кроків
стосуються authored timeline і не повинні непомітно перетворитися на ліміт options.

### 7.2. Зміни шляху відповіді

- Відв'язати `ChoiceSelectionLogic`, `ChoiceAnswerLogic`, `AnswerCheckLogic`,
  `AnswerSubmittedUseCase` від type=choice. Не міняти механіку на choice заради кнопок.
- Додати необов'язковий `choiceOrder` у `all-play-answer` і `final-answer-submit`,
  entry/all-play storage та final answer storage. Оновити presentation schemes,
  action DTO, OpenAPI metadata, client protocol, preview protocol.
- Валідувати membership, integer order, унікальність order і відсутність forged key.
  Текстовий payload не є доказом правильності image-only option.
- Глобальне блокування вже неправильної option зберегти тільки для поточного
  послідовного buzzer-сценарію. В all-play один гравець не блокує відповіді інших.
- На P1 normal-for-all + select не вмикати buzzer і не переходити у single-answerer.
- У фіналі зберегти чинний ручний review і приватність ставки. Додати selection input,
  але не змінювати фінальне суддівство number/point на automatic без окремого рішення.
- Перевірити `QuestionStage`, `useAnswerChoices`, `optionAnswer`, dock models,
  selectors.canAnswerNow, pending/accepted retry guard, reveal, final/all-play stages.
- В options reveal/`QuestionContentPlanLogic.buzzerOpensAt` врахувати select-формат;
  не відкривати відповідь до показу потрібних даних/готовності медіа.

Приватні поля correctChoiceOrder/rightAnswers не додаються до public question.
У all-play до review не віддавати навіть чужий choiceOrder: він теж розкриває відповідь.
Не дати spread-операціям повернути новий приватний field у mapToSimpleQuestion.

## 8. P3 — клік на картинці

### 8.1. Явне цільове входження

У стандартному SIQuester target — останній content item питання, якщо це image.
Під час читання SIQ зберігати зв'язок source item → imported file occurrence → order.
Встановити `pointImageOrder` саме для цього входження після побудови sequence.
Не шукати target за MD5: однаковий файл може стояти і на початку, і в кінці.
У script-питанні target визначає активний showContent перед відповідним askAnswer,
а не довільна остання картинка з усіх параметрів/відповідей.

Якщо target не знайдений, зник через відсутній файл або кінець standard question
не відповідає формату point, зберегти mode=point і critical needsRepair.
Не підставляти перше зображення й не перетворювати відповідь на text.
Для старих власних OQ-питань без pointImageOrder зберегти нинішній fallback на перше.

```ts
// Шаблон. sourceIndex присвоюється у readV5 і проходить крізь toSequence.
type ImportedImageOccurrence = { sourceIndex: number; order: number; kind: string };

function pointTargetOrder(
  lastSourceIndex: number,
  occurrences: ImportedImageOccurrence[],
): number | null {
  const matches = occurrences.filter(
    (item) => item.sourceIndex === lastSourceIndex && item.kind === "image",
  );
  return matches.length === 1 ? matches[0]!.order : null;
}
```

Перевірити `fromUpload` → draftPointImage → save/reload → `toUpload` →
`withPointImageDimensions` → PackageRepository → PointImageLogic → player picker/reveal.
Не виправляти глобально pointImage(..., null): це змінило б усі старі OQ-пакети.

### 8.2. Метрика: чому одного нового радіуса недостатньо

Нехай `dx`, `dy` — різниця нормалізованих координат, `a` — третє число відповіді SIQ,
`A` — фактично виміряне oriented width/height завантаженого зображення.

- SIGame перевіряє `hypot(a * dx, dy) <= max(0.02, sourceDeviation)`.
- Для старого `x,y` SIGame бере `a=1`, навіть якщо картинка не квадратна.
- Нинішня native OQ-перевірка за наявності geometry: `hypot(dx, dy / A) <= radius`.

Якщо a=A, можна перерахувати radius=sourceDeviation/a. Але для старого x,y або
округленого/відмінного a одного скалярного радіуса недостатньо: області мають різні
пропорції. Тому **не змінювати native OQ metric і не обіцяти точність лише діленням радіуса**.

Рекомендоване мінімальне розширення: optional `answerPoint.sourceGeometry` у вже
наявному JSONB. Воно вмикає точну імпортовану метрику лише для цих питань.
`imageAspectRatio` залишається виміряною геометрією зображення для native UI;
`sourceGeometry.aspectRatio` — незалежне значення з SIQ, його не перезаписує optimization.

```ts
// Пропозиція розширення AnswerPointDTO / UploadQuestion / DraftQuestion.
interface ImportedPointTarget {
  x: number;
  y: number;
  imageAspectRatio?: number;
  sourceGeometry?: { kind: "sigame"; aspectRatio: number };
}

function parseSiqPoint(raw: string, rawDeviation: string | null) {
  const parts = raw.split(",").map((part) => part.trim());
  if (parts.length !== 2 && parts.length !== 3) return null;
  if (parts.some((part) => part.length === 0)) return null;
  const [x, y, suppliedAspect] = parts.map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x! < 0 || x! > 1 || y! < 0 || y! > 1)
    return null;
  // Некоректний третій компонент — needsRepair; не вгадувати іншу картинку.
  const aspectRatio = parts.length === 3 ? suppliedAspect! : 1;
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return null;
  const suppliedDeviation = rawDeviation == null ? 0 : Number(rawDeviation);
  if (!Number.isFinite(suppliedDeviation) || suppliedDeviation < 0) return null;
  return {
    target: { x: x!, y: y!, sourceGeometry: { kind: "sigame" as const, aspectRatio } },
    deviation: Math.max(0.02, suppliedDeviation),
  };
}

function importedPointVerdict(
  target: ImportedPointTarget,
  picked: { x: number; y: number },
  deviation: number,
): boolean | null {
  if (!target.sourceGeometry) return null; // Викликати чинну OQ-гілку без змін.
  const a = target.sourceGeometry.aspectRatio;
  return Math.hypot((picked.x - target.x) * a, picked.y - target.y) <= deviation;
}
```

Ці шаблони описують valid SIQ input. Невалідні координати/NaN/нескінченність,
більше трьох компонентів і хибний aspect дають repair-діагностику. Не зберігати
вже розпарсовані 0,0 через Number(порожній рядок). Для від'ємного aspect/deviation
не відтворювати випадкові lenient fallback старих версій, а явно позначити зіпсовані дані.

Для візуалізації імпортованого допуску нормалізовані півосі `rx=d/a`, `ry=d`.
Рендерити саме цю область у PointPicker/reveal, без `aspect-ratio:1`, якщо фактична
область після відображення не кругла. Власний native круг і slider не змінюються.
Усі role views і preview мають показувати область, яку перевіряє сервер.

При першому явному редагуванні автором радіуса/target як native OQ значення
прибрати sourceGeometry і перевести поле в native mode з зрозумілим повідомленням.
Просте відкриття, autosave, вимірювання картинки, зміна тексту або `.oq` round-trip
не змінюють метрику. Заміна/crop/rotate target використовує чинний reset coordinates
і очищає sourceGeometry; undo відновлює обидва. Перестановка стороннього audio — ні.

Точки змін: DTO і Joi для answerPoint; `PackageQuestion.import/toDTO`; `.oq` reader,
export і draft; `pointImageDimensions`, `preparePreview`, `AnswerCheckLogic`,
`checkPreviewAnswer`, `PointPicker.tsx`, `AnswerReveal`, `ShowmanPanel`, `PointAnswer`.
sourceGeometry/правильний target — приватні дані до reveal, як нинішній answerPoint.

Приклад acceptance: a=2, d=0.05, target=(0.5,0.5), click=(0.54,0.5) → wrong.
Наше native OQ-питання з radius=0.05 і A=2 для того ж click продовжує давати right.
Різниця правильна: імпорт має зберігати правила джерела, власні питання — наші правила.

## 9. P4 — aliases, старі формати та секрети

### 9.1. Один шлях нормалізації

Порядок: прочитати XML → створити невеликий normalized question → застосувати
legacy upgrade → розв'язати script/params → перевірити семантику → створити UploadQuestion.
Не розкидати обробку self/knows/price по UI, backend і кількох альтернативних reader.

| Джерело | Ціль |
|---|---|
| відсутній тип / порожній type | Default контексту: звичайний раунд simple, звичайний фінал наявна final-механіка |
| simple / withButton | simple |
| auction / stake | stake |
| sponsored / noRisk / forYourself | noRisk; власний типовий multiplier=2 зберігається |
| stakeAll | stake + forEveryone |
| forAll | simple + forEveryone |
| cat | secret; exceptCurrent; cost→realPrice або priceRule; priceAnnouncement afterTransfer; theme ігнорується |
| bagcat | self→transferType, knows→priceAnnouncement/outcome; cost переноситься, theme ігнорується |
| secret | secret; modern selectionMode, price→realPrice або priceRule; окрема theme ігнорується |
| secretPublicPrice | secret; priceAnnouncement beforeTransfer, price вибирає receiver |
| secretNoQuestion / bagcat knows=never | secret; outcome award; question body не обов'язковий |
| історичний secretOpenerPrice | secret; вибір ціни opener до передачі, а не просто alias modern publicPrice |
| історичний choice | select тільки якщо є однозначно підтримана структура options; інакше repair |
| custom + script | Стандартний еквівалент або P6; назва сама по собі не визначає поведінки |

Параметр self відсутній у старому cat/bagcat → exceptCurrent. Сучасний
selectionMode=any → any, exceptCurrent → exceptCurrent; відсутній → exceptCurrent,
як у поточному SIGame runtime. Невідоме значення дає warning/repair, а не any.
`selectionMode=current` не оголошувати стандартним новим видом секрету: режим
setAnswerer=current у script — інша операція.

Default тип у SIGame може залежати від режиму кімнати (Classic/Quiz/TurnTaking).
SIQ не містить повного набору room settings. Default import використовує наш
Classic-контекст; інший контекст слід обрати явно й показати в import report.
Не приписувати пакету неіснуючі налаштування й не змінювати кімнату потайки.

### 9.2. SecretRules без дублювання fixed realPrice і зрізання діапазонів

Наявний allowedPrices 2–5 зберегти для власних legacy-питань. SIQ NumberSet не
розкладати в цей масив і не урізати: допустимі значення можуть бути численними.
Фіксована фактична сума має єдине місце збереження — question.realPrice (розділ 3.1).
У secretRules зберігається тільки правило динамічного вибору, якщо він потрібен.
Окрему тему в SecretRules не додаємо.

```ts
// Пропозиція typed DTO і nullable jsonb secret_rules.
type SecretPriceRule =
  | { kind: "roundExtremes" }
  | { kind: "range"; min: number; max: number; step: number };

interface SecretRules {
  outcome: "question" | "award";
  priceAnnouncement: "beforeTransfer" | "afterTransfer";
  priceChooser: "opener" | "receiver";
  priceRule: SecretPriceRule | null; // null: fixed getRealPrice(), без вибору.
}

function isAllowedSecretPrice(
  question: QuestionPriceFields,
  rule: SecretPriceRule | null,
  price: number,
  round: { min: number; max: number },
): boolean {
  if (!Number.isSafeInteger(price) || price < 0) return false;
  if (rule === null) return price === getRealPrice(question);
  if (rule.kind === "roundExtremes") return price === round.min || price === round.max;
  return price >= rule.min && price <= rule.max &&
    (rule.step === 0 || (price - rule.min) % rule.step === 0);
}
```

- Modern NumberSet: спочатку min=max=0 → priceRule=roundExtremes;
  min=max>0 → question.realPrice=min, priceRule=null;
  min<max, step=0 → усі цілі в діапазоні; step>0 → дискретний діапазон.
- Legacy cost: N>0 → question.realPrice=N, priceRule=null; 0 → roundExtremes; `[a;b]` → лише endpoints
  (нормалізувати як step=b−a); `[a;b]/h` → крок h. Не плутати legacy відсутній крок
  із modern явним нулем. min=max обробляти до обчислення кроку.
- Брати round extrema з номінальних getVisiblePrice() playable клітинок, виключаючи price=-1;
  використовувати повну серверну модель, а не public DTO із прихованими значеннями.
  Чужий realPrice не змінює source round extrema. Snapshot значень — на старті питання.
- Валідатор NumberSet перевіряє цілі, bounds, min≤max, step≥0 і серверний price cap.
  Некоректні дані не виправляти тихим підставленням board price.
- Під час вибору ціни для великого діапазону дати number input із min/max/step,
  а не генерувати сотні тисяч кнопок. Таймаут вибирає найменше допустиме значення.
- Якщо secretRules=null — чинний шлях allowedPrices зберігається; після вибору
  він встановлює live question.realPrice, а не перезаписує question.price.
  Якщо priceRule заданий — realPrice ще не resolved, доки не прийнято допустиме значення.
  Результат пишеться тільки в game state; no-choice fixed реальна ціна береться getter-ом.
  Конфлікт fixed authored realPrice з dynamic priceRule або legacy allowedPrices
  відхиляти чи нормалізувати один раз, не обирати випадкову authoritative гілку.

### 9.3. Порядок оголошення і бонус

Розширити secretQuestionData явним поточним кроком та actor; перевикористати
transfer/price actions і таймер secretTransferMs. `SecretQuestionValidator` визначає
дозволеного actor за кроком, а не завжди вимагає receiver.

1. secret: transfer → announce realPrice/range → receiver price, якщо потрібен → content/answer.
2. publicPrice: announce realPrice/range → transfer → receiver price, якщо потрібен → content/answer.
3. historical openerPrice: announce range → opener price → transfer → content/answer.
4. award: transfer → reveal/resolve realPrice → нарахування → завершення; без askAnswer.

Тема всюди залишається темою клітинки; окремого theme announcement немає.
До priceAnnouncement приховані realPrice/range не потрапляють у public snapshot,
question-pick event або board summary. Пізній reconnect отримує тільки вже розкриті дані.
Showman бачить потрібну інформацію у своєму приватному контексті.
Номінальні тема/price клітинки лишаються видимими за чинними правилами власних OQ типів.

Бонус автор оформлює як різновид secret з outcome=award. **До прийнятої передачі
гравці бачать звичайне секретне питання**: та сама назва, badge, вибір отримувача
й тексти підтвердження, без слова «бонус» і окремої іконки. outcome та будь-які
ознаки award не передавати в public question/secret state, події чи reconnect snapshot.
Лише після фіксації отримувача розкрити, що це бонус, і нарахувати суму.
Приватний редакторський/showman view може знати різновид заздалегідь.

Для award окремий доменний результат містить recipient, getRealPrice() після resolution і reason.
Застосувати score clamp, played mark, timer cleanup і запис у статистику рівно один
раз через executor/declared mutations. Пропонований broadcast `secret-question-awarded`
повинен мати typed payload і локалізоване пояснення; не вигадувати answer-submitted
або правильну відповідь гравця, якого не просили відповідати.
Дублі дії, таймаут одночасно з click та reconnect не нараховують бонус повторно.

Валідація editor/server дозволяє порожнє тіло лише для валідного award-secret;
не послаблювати перевірку звичайних питань. Редактор показує окремо «Без питання:
отримувач одразу одержить ...», а не порожню форму з помилкою missing answer.

Основні файли: `SecretQuestionService.ts`, `SecretQuestionValidator.ts`,
`domain/types/dto/game/state/SecretQuestionGameData.ts`,
`domain/state-machine/handlers/special-question/ChoosingToSecretTransferHandler.ts`,
`SecretTransferToAnsweringHandler.ts`, `application/usecases/question/SecretQuestionTransferUseCase.ts`,
`SelectSecretQuestionPriceUseCase.ts`, timer expiration path; browser `useSecretTarget.ts`,
dock secret controls, `previewSpecial.ts`, локалізації й badge descriptions.

## 10. P5 — час відповіді й зміст, потрібний для збереження сценарію

### 10.1. answerDuration — окреме поле з правильною семантикою

Додати nullable `answerDurationMs`, а не підміняти ним чинний `answerDelay=5000`.
`answerDelay` зараз не визначає момент buzzer opening; його автоматичне включення
змінило б усі старі пакети. Відсутність/0 source answerDuration означає room default.
Позитивні цілі секунди конвертувати в ms один раз; invalid/overflow — repair.

SIGame застосовує duration залежно від ask mode:

| Контекст | Що перевизначає answerDurationMs |
|---|---|
| button/simple | Вікно натискання після презентації; наступне submit-вікно після buzz зберігає room answerSubmitMs |
| direct, один answerer | Вікно відповіді призначеного гравця |
| all-play / типовий фінал | Спільне вікно прихованих відповідей після презентації |
| script з кількома askAnswer | Вікно конкретного ask step, а не тривалість усього питання |

Точки інтеграції: `QuestionContentPlanLogic.questionTimerDuration`,
`ShowingToAnsweringHandler`, `SecretTransferToAnsweringHandler`, stake transition,
`FinalMediaToAnsweringHandler`, `FinalBiddingToAnsweringHandler`, expiration path,
previewRuntime і useTimedAnswer. Презентація не від'їдає відведений на відповідь час.
Pause/reconnect використовують серверний remaining timer, без повторного повного вікна.
Перевірити source semantics у `GameController` на AskToPress, AskDirectAnswer,
HaveMultipleAnswerers перед інтеграцією; не застосовувати один override до всіх таймерів.

### 10.2. Текст відповіді, авторський час і репліки

Схема `right` означає еталон для перевірки, а `params/answer` — контент показу.
Це різні дані. Не замінювати right поясненням і не втрачати пояснення заради right.

Мінімальне сумісне розширення наявної timeline-моделі:

- Додати `answerTextItems` у спільному order space з answerFiles;
  підтримати screen text до/після media і старий текст після marker.
- Розширити QuestionTextItemDTO optional `durationMs`, `waitForFinish`,
  `placement: screen|replic`; для основного тексту запропоновані optional
  `textDurationMs`/`textWaitForFinish`. Не ламати `textOrder=null` caption.
- Для порожніх timed items зберігати явну паузу/крок, а не відкидати по trim().
  Відрізняти «clear screen» і «пауза зі збереженням попереднього екрана» за upstream
  handler і fixture; не визначати це з порожнього рядка навмання.
- `replic`/`say` зберігати як окремі приватні timed items ведучого, з order і duration.
  Не переносити pure-oral question у публічний text. Питання з валідною реплікою
  є змістовним, навіть якщо на екрані тільки повідомлення «Ведучий озвучує питання».
- `info/comments` зберегти окремо як пояснення після відповіді;
  `showmanComments` — як приватну інструкцію до reveal, без змішування з репліками.
- Невідомі placement/content item із впливом на гру — compatibility issue, а не continue.

Це цільові поля, їх остаточний wire layout визначається в P5 після small fixture.
Перевикористати `authoredContentGroups`/`QuestionContentPlanLogic`, не вводити
другу систему медіапрогравання. Оновити імпорт, server model/DTO, renderer,
ShowAnswerLogic, preview, content-limit accounting, `.oq` і тест order collisions разом.
Приватні replic items лишаються в повній серверній моделі й showman projection;
public mapper відфільтровує їхній text. В content plan може залишатися безпечний
order/timing/placement кроку, щоб клієнти зберігали синхронізацію без отримання репліки.
Підрахунок source groups робиться **до** пропуску missing/unsupported items;
нові text/replic/pause items не є способом обійти чинні 30 кроків/10 файлів.

Приклад: right=`Париж`, answer content=`Париж — столиця Франції`, потім image.
Очікування: answerText/еталон не змінюється; у reveal показано все пояснення й image
у заданому порядку; до reveal жоден із цих елементів не потрапляє гравцям.

## 11. P6 — структуровані сценарії, а не виконання довільного коду

Стандартний script спочатку порівнювати з відомими шаблонами SI і точно компілювати
в simple/stake/forAll/secretRules + answerFormat. Порівняння враховує порядок кроків,
params, references, fallbackRefId і duration; самої наявності setAnswerer(all) недостатньо.
Невідомий або змінений шаблон не повинен «майже збігтися» й загубити кроки.

Коли точна компіляція неможлива, потрібен обмежений data-driven interpreter на
сервері. Це частина повного плану, а не підстава знову робити fallback у simple.
Виконуються лише typed операції SI, без C#/JS/eval/HTML/network code.

| Операція SI | Цільова дія на сервері |
|---|---|
| setAnswerType | Встановити text/number/point/select і відповідні приватні параметри для поточної фази |
| showContent | Показати inline або referenced content через чинний content plan |
| askAnswer | Відкрити button/direct input з duration; зберегти continuation |
| setAnswerer | current / byCurrent / all; stake highest+visible / allPossible+hidden |
| announcePrice | Оголосити умови вартості, не переплутати з її остаточним вибором |
| setPrice | select NumberSet або multiply за відповідним правилом |
| setTheme | Усвідомлений no-op за нашим дизайном: тема клітинки не змінюється |
| accept | Одноразово зарахувати результат поточним answerers і просунути script |

`client` input лишається unsupported critical; не додавати мініігровий engine під
виглядом підтримки scripts. Якщо preflight знайшов HTML у script/options/answer,
застосувати чинне видалення HTML-питання. Це виключення з обсягу, задане користувачем.
Ігнорування setTheme — ще одна погоджена адаптація: крок розпізнається й одразу
пропускається без нового поля, очікування, broadcast або needsRepair. Стандартний
script compiler дозволяє такий no-op і не відхиляє шаблон через зайву спеціальну тему.

```ts
// Ескіз state persisted у game Redis snapshot; не поточний DTO.
interface QuestionScriptProgress {
  questionId: number;
  programCounter: number;
  waitingFor: "content" | "answerer" | "price" | "answer" | null;
  activeAnswerFormat: "text" | "number" | "point" | "select";
  appliedEffects: string[]; // step execution identity, не довільний журнал усіх подій.
}
```

Runtime requirements:

1. Власник continuation — доменна логіка; application handler завантажує потрібні
   ресурси й повертає mutations. Transport/controller не змінює script cursor.
2. Просування відбувається тільки всередині GameActionExecutor. Content completion,
   вибір ціни, відповідь, review, skip і timeout мають однозначний continuation.
   setPrice/select встановлює live realPrice; setPrice/multiply використовує
   getRealPrice() як базу. Видимий price не є змінною робочого стану script.
3. Pure кроки виконуються до наступного waiting step з bounded work per action;
   немає циклів чи довільних jump у переліку SI-операцій. Довгий ланцюжок не обходить
   queue fairness. Ефекти і programCounter зберігаються атомарно з game state.
4. Кілька askAnswer не повинні позначати всю клітинку played/нараховувати загальну
   вартість повторно випадково. Результат кроку й завершення питання — різні події.
   Дозволені source accept-кроки зберігають свої явні ефекти; duplicate action не дублює їх.
5. Вхідні посилання розв'язуються лише у параметрах поточного питання; відсутній
   reference/cycle/невідома операція дають repair. Підтримати fallbackRefId=right
   як визначено SIEngine, з урахуванням select/point reveal, а не лише plain text.
6. У snapshot гравця — лише поточний безпечний view і стан очікування.
   Не віддавати весь script/params: там можуть бути майбутні відповіді, картинки,
   target, correctChoiceOrder і прихований realPrice. Повний script зберігається server-side.
7. Після reconnect відновлюються cursor, actor, уже розкрита фактична ціна, приватні
   submissions і залишок timer. Не виконувати preamble/accept повторно.
8. Skip/round end/player leave зупиняють або завершують поточне очікування через
   наявні lifecycle правила; не залишати orphan timer і не змінювати eligibility тихо.
9. Контентні ліміти рахувати по розв'язаних authored groups у question/answer частинах,
   включно з repeated references. Число script commands не підміняє число media steps.
10. Локальний playtest має той самий typed program і переходи, включно з кроками після
    першої відповіді. Preview першої картинки не є доказом виконання script.

Чинні правила SIGame кімнати (штрафи, множники, спосіб вибору default питання)
не є всі збереженими в SIQ. Явно задокументувати mapping до чинних OQ settings;
історичні setPrice noRisk/forYourself/withButton/forAll нормалізувати лише після
перевірки семантики відповідної версії. Fixtures для історії фіксувати на її revision.

### 11.1. Фінал і контекст типу

Зараз `siq.ts` примусово ставить simple у фіналі; finalRoundThemes у Joi також
дозволяє лише simple. Для звичайного успадкованого фіналу це сумісна OQ-форма,
але явний тип/script не можна непомітно знищувати.

- Default/empty у фіналі → чинна final-механіка; select/number/point — незалежний input.
- Явний інший тип → збережений compiled script або typed program. Визначати його
  preamble **до** входу в final bidding, щоб не зібрати ставки для noRisk/award.
- Вибір фінальної теми належить раунду; поведінка вибраного питання — його сценарію.
  Розвести ці рішення у final transition/router, а не перевести весь раунд у simple.
- Зберегти чинну приватність final bids і правило first accepted bid для звичайного фіналу.
  Нові input types не скасовують ці правила.
- `themeList` останнього раунду розпізнати як alias final; `table`/`standart` — simple.
  Наявні структурні адаптації раннього final/зайвих питань теми залишаються явними
  повідомленнями; розширення кількості фінальних раундів не є частиною цієї роботи над типами.

## 12. Контракти, збереження й сумісність

Впроваджувати optional поля адитивно. Нові enum значення не потребують зміни
PostgreSQL type question.type: цей набір зберігаємо. answer_type і sub_type зараз
varchar; нові JSONB/nullable columns і option sourceLabel потребують явних міграцій.

| Дані | Що змінити й перевірити |
|---|---|
| select | AnswerType enum, DTO/Joi, options та key validation, option sourceLabel, усі question variants у OpenAPI |
| realPrice | Nullable int real_price на PackageQuestion, getters/helpers, DTO/Joi/OpenAPI, draft/`.oq`, live resolution і conditional public reveal |
| all-play simple | AllPlayMode enum, state/start payload, reducer, scoring snapshot, лейбли й stats |
| explicit selection | answer-submitted / all-play-answer / final-answer-submit input, stored answer identity, role-filtered snapshot |
| point sourceGeometry | JSON answerPoint, Joi/OpenAPI, import/toDTO, `.oq`/draft/export, приватний reveal |
| secretRules | Новий nullable jsonb без theme і fixed value, package import/replacement, priceAnnouncement view, secret game state |
| duration/content | answerDurationMs, текстові/реплікові items, answerTextItems; orders і role filtering |
| scripts | typed private package data, validated operands/references, server cursor, безпечний public projection |
| diagnostics | Чернетка/архів і health validation; не підміняти ними runtime поля REST |

Для кожного нового поля пройти весь ланцюжок: UploadQuestion → DraftQuestion →
toUpload → Joi → PackageRepository create/replace → entity.import → entity.toDTO →
PackageStore/game resource → appropriate mapper → state/event → web protocol →
preview/reveal → `.oq` export/reimport. Не обмежуватися додаванням колонки.

Міграції: nullable/default-compatible поля; без backfill геометрії або автоматичного
перетворення вже опублікованих пакетів. Виправлений SIQ імпортується повторно або
перепубліковується автором. Для заміни пакета перевірити cascade option rows,
unused-media cleanup і збереження повторних входжень hash.
real_price для наявних записів лишається null, тому getRealPrice() повертає чинний
price. У Joi перевіряти realPrice як ціле finite невід'ємне число в чинному price cap;
не робити його required й не відхиляти 0 як falsy. У final без базової ціни getter
може повернути null; суму результату визначає особиста ставка, а не автоматичний 0.

Оновити `openapi/schema.json`, запустити schema validation і генерацію REST типів.
`web/src/api/schema.d.ts` не редагувати вручну. `web/src/game/protocol.ts`
та socket metadata оновити окремо разом із server emitters і presentation schemes.
Перевірити union/oneOf для кожного виду пакета, а не лише спільну base schema.

Новий сервер і браузер розгортати узгоджено: старий клієнт може трактувати новий
all-play mode як noRisk або не показати select. Для активних старих game snapshots
optional fields мають legacy defaults. Відкат має явно відхиляти нові непідтримувані
пакети/стани, а не починати їх за старими правилами. Нові міграції перевірити up/down
на тестовій базі; цей документ не дає дозволу на production migration/deploy.

## 13. Перевірки: що має доводити кожний рівень

### 13.1. Обов'язкові acceptance cases

| ID | Вхід / дія | Очікуваний результат |
|---|---|---|
| A01 | SIQ forAll text, ціна 100, три гравці | Немає ставок/buzzer; усі відповідають; +100/−100 за subtract |
| A02 | Те саме, room penalty=none | Wrong=0; noRisk-питання й їхні множники не змінені |
| A03 | SIQ stakeAll | Приховані особисті ставки; кожен отримує ±власну ставку; не simple fallback |
| A04 | OQ noRisk+forEveryone, multiplier=2 | Чинні +2×price/0 збережені після round-trip |
| A05 | stake/secret/forAll + select | Збережені і механіка, і options; scoring відповідає механіці |
| A06 | Select C, однакові тексти/однакові image hash | Exact key визначається міткою/choiceOrder; немає вгадування за текстом |
| A07 | Невідома/дубльована right label | Draft з repair; publication/playtest заблоковані, варіанти не загублені |
| A08 | Select image/audio/video, 9 та 30 options | Програвання не вибирає відповідь; не обрізається до 8; HTML відхиляється |
| A09 | Forged/duplicate choiceOrder, повторний submit | Валідаційна помилка; перша прийнята відповідь не замінюється |
| A10 | Два all-play гравці вибрали ту саму неправильну option | Обидві submissions прийняті; чужий вибір не заблокував option |
| A11 | Point: дві картинки; target остання | pointImageOrder вказує останнє входження після import/save/publish/reconnect |
| A12 | Point: та сама картинка двічі з одним MD5 | Target — правильна occurrence, а не перший hash match |
| A13 | Point a=2,d=.05,target .5,.5; click .54,.5 | Імпортований SIQ wrong; native OQ radius .05 лишається right |
| A14 | Старий SIQ x,y на картинці 2:1 | Метрика a=1 збережена; actual aspect не підмінив source aspect |
| A15 | Point із відсутнім/0 deviation | SIQ minimum .02; власний native OQ 0 і default .05 не змінені |
| A16 | Target missing або x/empty/NaN/∞/зайва координата | Mode point з repair; немає мовчазного text/first-image fallback |
| A17 | Edit native radius/crop target, undo, reorder audio | Метрика змінюється тільки за явної геометричної дії; undo відновлює target+metric |
| A18 | bagcat self=false/missing, knows before/after/never | Передача, priceAnnouncement і bonus збережені; окрема тема свідомо ігнорується |
| A19 | NumberSet fixed/round-extremes/range/step; legacy [a;b] | Усі допустимі значення збережені; endpoint-режим не став continuous |
| A20 | secretPublicPrice і historical openerPrice | Оголошення/вибір відбуваються в різному правильному порядку й дозволеним actor |
| A21 | Award-secret без тексту/answer; reconnect до передачі; duplicate+timeout | До прийнятої передачі виглядає як звичайний secret і не розкриває outcome; після передачі бонус оголошено й нараховано рівно раз; немає fake answer |
| A22 | answerDuration 15 у button/direct/all-play/final | Відповідне вікно 15 s; контент і submit-after-buzz мають правильні незалежні timers |
| A23 | answer text+image, marker, timed text, pure replic | Весь зміст і порядок збережені; приватний текст ведучого не показаний гравцям |
| A24 | Script inline/ref/fallback right; кілька askAnswer | Кроки виконані в порядку; продовження/review/score не дублюються |
| A25 | Script unknown op/ref cycle/forbidden HTML/client | Не запускається інший сценарій; repair або чинна HTML-removal policy |
| A26 | Роль spectator/showman, reconnect до review/reveal | Немає чужих submissions, keys, target, майбутнього answer або hidden stakes |
| A27 | Pause/leave/timeout/restart під час відповіді чи price choice | Remaining time/cursor/actor збережені; немає orphan timer/подвійного бонусу |
| A28 | OQ всі старі типи, hidden, choice, noRisk-for-all | Старі архіви/публікації граються без зміни формул і implicit geometry |
| A29 | 5+ visuals, 11 files/group, 31 content steps | Чинна адаптація/відмова й повідомлення; жодного підвищення лімітів |
| A30 | Звичайна price=-1 порожня клітинка | Залишається неактивною; не з'явилося нове питання за 0 балів |
| A31 | price=100, realPrice=500; secret reveal/right/wrong | Табло завжди 100; після announcement показано 500, delta +500/−500; обидва getters узгоджені |
| A32 | realPrice відсутній/null/0 | Відсутній/null → price; явний 0 → 0 в reveal, scoring і preview; немає `|| price` |
| A33 | Dynamic range, обрано 400 при price=100; дві гри з одним пакетом | Live realPrice=400, price=100; пакет і друга гра не змінені; до вибору scoring заблокований |
| A34 | Reconnect до/після розкриття realPrice і перед передачею bonus | До reveal приховані realPrice/range/outcome не витікають; після reveal реальна сума відновлена без зміни табло |
| A35 | SIQ theme / legacy cat theme / script setTheme не збігаються з темою клітинки | Тема клітинки лишається; немає окремого theme field, announcement, needsRepair або зупинки script |
| A36 | realPrice із noRisk multiplier, winning stake і nominal roundExtremes | noRisk множить фактичну базу; ставка має свій пріоритет; roundExtremes читає номінали через getVisiblePrice |

### 13.2. Рівні й файли

- Parser/round-trip unit: розширити `web/src/features/upload/parse.test.ts`,
  `htmlRemoval.test.ts`, `pointImageDimensions.test.ts`, `.oq`/export tests;
  fixture assertions мають перевіряти значення, порядок, options, target і issues, а не тільки count.
- Price helpers і entity methods: однакові результати для відсутнього/null/0 realPrice;
  integration tests доводять, що вибір ціни не перезаписує nominal у БД, кеші пакета й board DTO.
- Domain unit: `server/tests/game/AllPlayLogic.test.ts`, `AnswerCheckLogic.test.ts`,
  `ChoiceAnswerLogic.test.ts`, `ChoiceSelectionLogic.test.ts`, `PointAspectValidation.test.ts`;
  додати мінімальні tests NumberSet/legacy normalization і script continuation там, де це нові правила.
- Package contract: `server/tests/package/package.test.ts`, `PackageOpenApi.test.ts`,
  `web/src/features/package-editor/validatePackage.test.ts`, `export.test.ts`.
- Transport: розширити `server/tests/socket/game/question/AllPlayQuestions.test.ts`,
  `ChoiceQuestionFlow.test.ts`, `SecretQuestionFlow.test.ts`, `SecretQuestionPrice.test.ts`,
  `PointRevealReconnect.test.ts`; final submit/privacy перевірити також final suites.
- Для нової спостережуваної backend поведінки додати focused E2E smoke через чинний
  `ServerTestHarness`/scenario flow; перед написанням читати `backend-smoke-tests`,
  `backend-e2e` і `server/tests/e2e/README.md`. Тут не вигадуються сигнатури helper API.
- Browser/component: PointPicker, pointAnswerFlow, choice selection/input gating,
  editor QuestionDialog, pointImageTarget, playtest previewRuntime та reveal tests.
- Real browser/backend: шлях import → publish → create game → answer/review → reconnect
  для normal-for-all+select і point з двома картинками; desktop/tablet/phone, включно
  з keyboard/focus і failed-send retry. Browser-only tests окремо від transport ACK.

Диференційні point-приклади обчислювати незалежним oracle з формули upstream;
не копіювати одну нашу функцію і в expected, і в actual. Для alias/script tests
залишити upstream revision і пояснення очікуваної поведінки в fixture metadata.
Не вважати green snapshot тестом реальної медіаготовності чи клікабельності картинки.

### 13.3. Команди перевірки

Для focused backend verification використовувати `test:pipeline`; перед запуском
прочитати `.agents/skills/backend-test-runner/SKILL.md`. Інфраструктуру підіймати
лише потрібну; не підміняти недоступні PostgreSQL/Redis результатом «усе пройшло».

```powershell
# З server/:
npm run validate:schema
npm run lint
npm run build
npm run test:pipeline -- tests/game/AllPlayLogic.test.ts tests/game/AnswerCheckLogic.test.ts --runInBand
npm run test:pipeline -- tests/socket/game/question/AllPlayQuestions.test.ts --runInBand

# З web/ після зміни schema:
npm run gen:api
npm run check:api
npm run typecheck
npm run lint
npm test -- src/features/upload/parse.test.ts src/features/upload/pointImageDimensions.test.ts src/features/package-editor/pointImageTarget.test.ts
npm test
npm run test:browser
npm run e2e:full
```

Focused suites доповнюються відповідними cases P2/P4/P6. Після фінальних змін
виконати повний релевантний pipeline; повторювати зелені checks тільки після нових
змін або при конкретному невирішеному ризику. Source-code snippets у цьому документі
потребують інтеграції з DTO/enum changes; синтаксична перевірка прикладів не є build.

## 14. Документація, ризики й критерії завершення

Поточну поведінку імпорту, сценаріїв, цін, редактора й reveal описують
[матриця сумісності SIQ](../specs/siq-compatibility-matrix.md),
[стани гри](../specs/game-state-matrix.md),
[машина станів кнопки](../specs/buzzer-state-machine.md),
[валідація пакетів](../specs/package-validation-spec.md) та
[синхронізація медіа](../../server/docs/media-download-sync.md).

P0–P6 інтегровано на базі `6af8784e2d443fb251e4c6e61f51744f9f918c15`.
Критичні діагностики зберігають дані для ремонту в чернетці. HTML потребує
явної згоди на видалення питання. Окрема тема SIQ свідомо ігнорується.

Основні ризики:

1. Змішування механіки й input: ставки/секрет губляться при конвертації в choice.
2. Тихий default: невідомий type, порожній script body або помилкова точка стають simple/text.
3. Зміна старих OQ-пакетів: глобальний last-image fallback чи новий radius перерахунок.
4. Витік приватних даних через public mapper, all-play/final snapshot або повний script.
5. Подвійні score effects через timeout/retry/reconnect continuation.
6. Втрата нових полів на replacement, `.oq`, IndexedDB, preview або reveal.
7. Зрізання NumberSet/options за обмеженнями старої OQ-моделі замість точного подання.
8. Обхід або випадкове розширення HTML заборони/медіалімітів через новий script path.
9. Перезапис номіналу фактичною сумою, витік realPrice до announcement,
   scoring із unresolved діапазону або розсипані різні формули fallback.

### Докази приймання P7

- **A01–A10.** Імпорт і `.oq` зберігають механіку та ідентичність select.
  Socket.IO підтвердив три текстові відповіді за номінал 100, room penalty,
  особисті ставки, незалежні однакові вибори та блокування повторної відповіді.
  Реальний браузер перевірив публікацію `forAll` + select, reconnect і скоринг.
  Desktop також пройшов відмову сервера й повторний вибір із клавіатури.
- **A11–A17.** Імпорт, `.oq`, редактор і preview покривають вибір входження
  з повторним hash, метрику SIQ, native radius, діагностику та undo. Реальний
  браузер підтвердив кліки й reconnect після reveal на трьох профілях.
- **A18–A26.** Тести нормалізації, Socket.IO, preview і Chromium покривають
  NumberSet, legacy cat/bagcat, порядок оголошення, одноразову нагороду,
  авторський час і приватний контент, послідовні asks та блокування repair.
- **A27–A36.** Redis recovery підтвердив збереження курсора, актора і залишку
  часу та відновлення вичерпаного таймера до негайного спливу після unpause.
  Старі `.oq` пройшли round-trip для всіх типів. Формули перевірено окремими
  ігровими сценаріями. Тести цін підтвердили явний нуль у preview, ізоляцію
  ціни 400 між двома іграми та приховування ціни до оголошення.

Відновлення залишку часу діє для активних scripted answer/price waits, сучасних
виборів ціни secret, авторських вікон, select, normal-for-all, сучасних secret
та SIQ point відповідей. Уже призупинені таймери відповіді й ціни зберігають
свій залишок. Legacy таймери відновлюються з повною тривалістю. Це також стосується
імпортованого текстового `stakeAll` без нових полів, бо його збережений стан
збігається зі старим OQ `stake + forEveryone`.

### Прогони та обсяг перевірки

Знімок C9 містить 303 шляхи. SHA-256 `followup-c9-merged-manifest.json`
дорівнює `f2a5549473fa94f066bbce965286fa3f9e9f8773261803f77419930556a63d73`,
а 146-шляхового серверного маніфесту —
`ec47198c4585298aa24e8f2c648bd70b4449d3ef327e270f08ce37fa528d4ca0`.
Вебманіфест із 152 шляхів байт-ідентичний C8.

- **Сервер.** Повний окремий `test:pipeline` на C7 пройшов 1480/1480
  тестів у 141/141 наборах, exit 0. У C6 було 1473/1475. FIFO зберіг
  порядок дій, а повна перевірка спорожнення черги зайняла 505 мс при
  бюджеті 500 мс. GET стану публікації перевищив 2000 мс. У повторі
  пройшли обидва набори з тими самими межами часу. Артефакт
  `server-c7-quiet-full.json`. Повний C9 пройшов 1480/1480
  тестів у 141/141 наборах, exit 0. Початковий запуск C9 перервано через
  конфлікт із Jest watcher на спільній тестовій базі. Повтор використав
  окремі PostgreSQL і Redis через `TEST_DB_PORT=55442` і
  `TEST_REDIS_PORT=56389`. Артефакт `server-c9-isolated-full.json`.
- **Vitest і Chromium.** Повний Vitest на C8 пройшов 981/981 у 208/208
  наборах, exit 0. На C6 і C7 перший тест клавіатури, який відкривав
  прев’ю, перевищив час очікування. У C8 тест завантажує справжній модуль
  прев’ю до відкриття діалогу й виконує ті самі клавіатурні перевірки.
  Артефакт `followup-c8-web-vitest.json`. Під час P7 широкий прогін
  native Chromium дав 387/388. Цільовий повтор із виправленим
  очікуванням у point-сценарії дав 16/16, включно з єдиним попереднім
  падінням.
- **Live Playwright.** Повний C6 дав 154 проходження, 20 очікуваних
  пропусків і 9 падінь. Три падіння відтворили застаріле очікування
  заголовка звіту імпорту, шість — очікування переходу до відповіді після
  натискання бузера. Цільовий C7 дав 18/18 на desktop, tablet і phone.
  Повний C8 дав 162 проходження, 20 очікуваних пропусків і одне падіння.
  У phone-сценарії широка дошка пройшла перевірки розміру. Після вибору
  питання з пошкодженим зображенням гра залишалася на екрані підготовки
  довше за 45-секундний бюджет очікування `media-failed`. Цільові повтори на C8
  і C9 дали по 3/3. Артефакти `e2e-c7-targeted.json`,
  `e2e-c8-quiet-full.json`, `e2e-c8-media-before.json` і
  `e2e-c9-media-after.json`. Повний Playwright C9 без фільтрів на тому
  самому локальному стеку дав 163 проходження і 20 очікуваних
  пропусків, exit 0. Артефакт `e2e-c9-quiet-full.json`.
- **Таймери Redis.** Після успішного запису таймера через ігровий
  pipeline сервер один раз читає ключ відкриття або активний ключ
  після TTL. Redis публікує сплив. У C7 для вікна бузера 300 мс
  усі 14 виміряних повідомлень надійшли через 2–17 мс після TTL.
  У C6 окремий вимір зафіксував +6245 мс. Для 30-секундного таймера
  медіа сповіщення в C8 надійшли через 9109, 7975 і 8945 мс після TTL,
  а в C9 через 6, 3 і 10 мс. Використано той самий локальний Docker Redis,
  у DB0 на початку вимірів було 3499 і 2941 ключів із TTL відповідно.
  Вимірювався час до отримання повідомлення Redis. Артефакти
  `e2e-c6-timer-sample.log`, `e2e-c7-draw-sample.log`,
  `e2e-c8-media-before-redis.log` і `e2e-c9-media-after-redis.log`.
- **Ручна перевірка.** 16 архівів охопили пробний сценарій SIQ 3, SIQ 4/5,
  старі й поточні OQ та реальний експорт із редактора. На C6 повторно
  перевірено блокування публікації для критичних діагностик, згоду на
  видалення HTML, публікацію повторно імпортованого OQ, групові ставки,
  приховану нагороду, послідовні числові відповіді й фінал із двома
  однаково підписаними варіантами. Перевірки лімітів медіа та кроків
  належать до автоматизованих сценаріїв P7. Перелік архівів і докази
  збережено в `packages/manifest.json`, `manual-initial-evidence.md` і
  `manual-retest-evidence.md`.
- **Контракти й база.** На C9 успішно виконано перевірку схеми, lint і компіляцію
  сервера. Web typecheck, lint і перевірку REST-типів виконано на C7.
  У P7 на тимчасовій PostgreSQL п’ять міграцій застосовано поверх бази
  з 41 міграцією, відкочено й застосовано повторно. Старий рядок choice
  збережено.

### Checklist приймання

- [x] A01–A36 покриті відповідними перевірками P0–P7. Критичні repair-стани заблоковані для гри й публікації.
- [x] Normal-for-all застосовує фактичну ціну, room penalty та незалежні формати відповіді. StakeAll має окремі особисті ставки.
- [x] Старі OQ типи, формули та геометрію перевірено на round-trip і відповідних ігрових сценаріях.
- [x] Окрема тема SIQ ігнорується. Вибір фактичної ціни зберігає номінал і джерело пакета.
- [x] Контракти, міграції, REST-типи й Socket.IO перевірено. Приватні дані залишаються доступними згідно з роллю та етапом гри.
- [x] Збережено адаптацію для 5+ візуальних елементів, межі 10 файлів у групі й 30 кроків та вимогу згоди на видалення HTML.
- [x] Зафіксовано обсяг, початкові падіння і результати цільових повторів.

## 15. Історична перевірка початкового плану

Під час підготовки документа перевірено поточну базу OpenQuester, owning code
і зафіксовані першоджерела SI. Автоматична локальна перевірка підтвердила існування
явно зазначених повних repo paths і локальних Markdown-посилань, наявність
усіх A01–A36 та парність fenced blocks. TypeScript-шаблони пройшли
синтаксичну перевірку `typescript.transpileModule`; це **не** інтеграційна типізація
проти майбутніх DTO і не твердження, що приклади вже є працездатним патчем.

На початковому етапі `git diff --check` пройшов для плану й навігаційного
посилання в матриці сумісності SIQ. Результати реалізації та перевірки P7
наведено в розділі 14.
