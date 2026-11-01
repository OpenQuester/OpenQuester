import { strToU8, zipSync } from "fflate";
import { makePng } from "./seed.mjs";

/** Inert mixed SIQ used by upload, editor and browser regressions. */
export function mixedHtmlPack(title: string, largeManifest = false): Buffer {
  const padding = largeManifest ? `<!--${"x".repeat(600_000)}-->` : "";
  const xml = `<package name="${title}" version="5" language="en">${padding}<rounds><round name="Round"><themes><theme name="Theme"><questions>
    <question price="100"><params><param name="question"><item>Normal question</item><item type="image" isRef="True">retained.png</item></param></params><right><answer>Normal answer</answer></right></question>
    <question price="200"><params><param name="question"><item type="html" isRef="True">bad.html</item></param></params></question>
  </questions></theme></themes></round></rounds></package>`;
  return Buffer.from(
    zipSync({
      "content.xml": strToU8(xml),
      "Images/retained.png": new Uint8Array(makePng()),
      "Html/bad.html": strToU8(
        '<script>fetch("/html-sentinel"); window.htmlExecuted = true</script>',
      ),
    }),
  );
}
