import puppeteer from "puppeteer";
import path from "node:path";
import process from "node:process";

const url = process.argv[2] ?? "http://localhost:4173";
const output = path.resolve(process.argv[3] ?? "guitar-course.pdf");
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });
  await page.emulateMediaType("print");
  await page.pdf({
    path: output,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "14mm", right: "15mm", bottom: "14mm", left: "15mm" },
  });
  console.log(`PDF créé : ${output}`);
} finally {
  await browser.close();
}
