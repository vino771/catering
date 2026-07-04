// js/pdf.js
// PDF + TXT report generation. jsPDF and jspdf-autotable are loaded globally
// via <script> tags in reports.html / admin.html (window.jspdf).

import { formatINR, formatDisplayDate, formatMonthLabel } from "./utils.js";
import { MEAL_LABELS } from "./config.js";

const BRAND = {
  primary: [179, 58, 46], // brick accent
  ink: [35, 32, 27],
  muted: [120, 112, 100],
};

/**
 * rows: array of { date, meal, food, qty, price, lineTotal }
 * meta: { userName, monthLabel, generatedOn, dailyTotal, monthlyTotal, scope }
 */
export function generateUserPdf(rows, meta) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...BRAND.ink);
  doc.text("Food Expense Report", 40, 50);

  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(1.2);
  doc.line(40, 60, 555, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...BRAND.muted);
  let y = 82;
  doc.text(`User: ${meta.userName}`, 40, y);
  doc.text(`Period: ${meta.monthLabel}`, 300, y);
  y += 16;
  doc.text(`Generated on: ${meta.generatedOn}`, 40, y);
  if (meta.scope) doc.text(`Scope: ${meta.scope}`, 300, y);

  const body = rows.map((r) => [
    formatDisplayDate(r.date),
    MEAL_LABELS[r.meal] || r.meal,
    r.food,
    String(r.qty),
    formatINR(r.price),
    formatINR(r.lineTotal),
  ]);

  doc.autoTable({
    startY: y + 20,
    head: [["Date", "Meal", "Food", "Qty", "Price", "Line Total"]],
    body,
    theme: "grid",
    headStyles: { fillColor: BRAND.primary, textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 9.5, cellPadding: 6, textColor: BRAND.ink },
    alternateRowStyles: { fillColor: [250, 246, 239] },
  });

  const finalY = doc.lastAutoTable.finalY + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.ink);
  if (meta.dailyTotal !== undefined) {
    doc.text(`Daily Expense: ${formatINR(meta.dailyTotal)}`, 40, finalY);
  }
  doc.text(`Monthly Total: ${formatINR(meta.monthlyTotal)}`, 40, finalY + 18);

  doc.save(meta.fileName || "food-expense-report.pdf");
}

/**
 * Admin day summary PDF: food grouped by meal with aggregated quantities.
 * summary: { breakfast: [{name, qty}], lunch: [...], dinner: [...] }
 */
export function generateAdminSummaryPdf(summary, meta) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...BRAND.ink);
  doc.text("Daily Order Summary", 40, 50);
  doc.setDrawColor(...BRAND.primary);
  doc.line(40, 60, 555, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...BRAND.muted);
  doc.text(`Date: ${formatDisplayDate(meta.date)}`, 40, 82);
  doc.text(`Total Orders: ${meta.totalOrders}`, 300, 82);
  doc.text(`Total Expense: ${formatINR(meta.totalExpense)}`, 40, 98);

  let startY = 120;
  ["breakfast", "lunch", "dinner"].forEach((meal) => {
    const items = summary[meal] || [];
    if (!items.length) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...BRAND.primary);
    doc.text(MEAL_LABELS[meal], 40, startY);
    doc.autoTable({
      startY: startY + 8,
      head: [["Food", "Total Quantity"]],
      body: items.map((i) => [i.name, String(i.qty)]),
      theme: "grid",
      headStyles: { fillColor: BRAND.ink, textColor: [255, 255, 255] },
      styles: { fontSize: 9.5, cellPadding: 5, textColor: BRAND.ink },
      margin: { left: 40, right: 40 },
    });
    startY = doc.lastAutoTable.finalY + 22;
  });

  doc.save(meta.fileName || `admin-summary-${meta.date}.pdf`);
}

/* --------------------------------- TXT export --------------------------------- */

export function downloadTxt(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function buildUserTxtReport(rows, meta) {
  const lines = [];
  lines.push("FOOD EXPENSE REPORT");
  lines.push("=".repeat(40));
  lines.push(`User      : ${meta.userName}`);
  lines.push(`Period    : ${meta.monthLabel}`);
  lines.push(`Generated : ${meta.generatedOn}`);
  lines.push("-".repeat(40));
  rows.forEach((r) => {
    lines.push(
      `${formatDisplayDate(r.date)}  ${(MEAL_LABELS[r.meal] || r.meal).padEnd(9)} ${r.food.padEnd(16)} x${r.qty}  ${formatINR(r.price)}  = ${formatINR(r.lineTotal)}`
    );
  });
  lines.push("-".repeat(40));
  if (meta.dailyTotal !== undefined) lines.push(`Daily Expense : ${formatINR(meta.dailyTotal)}`);
  lines.push(`Monthly Total : ${formatINR(meta.monthlyTotal)}`);
  return lines.join("\n");
}

export function buildAdminTxtReport(summary, meta) {
  const lines = [];
  lines.push("DAILY ORDER SUMMARY");
  lines.push("=".repeat(40));
  lines.push(`Date          : ${formatDisplayDate(meta.date)}`);
  lines.push(`Total Orders  : ${meta.totalOrders}`);
  lines.push(`Total Expense : ${formatINR(meta.totalExpense)}`);
  lines.push("-".repeat(40));
  ["breakfast", "lunch", "dinner"].forEach((meal) => {
    const items = summary[meal] || [];
    if (!items.length) return;
    lines.push(MEAL_LABELS[meal].toUpperCase());
    items.forEach((i) => lines.push(`  ${i.name.padEnd(20)} ${i.qty}`));
  });
  return lines.join("\n");
}
