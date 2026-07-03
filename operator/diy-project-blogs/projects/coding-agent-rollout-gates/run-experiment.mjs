#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.join(projectDir, "dataset.json");
const outputPath = path.join(projectDir, "output.txt");
const resultsPath = path.join(projectDir, "results.json");
const chartPath = path.join(projectDir, "chart.svg");

const policies = {
  broadRollout() {
    return { seatRate: 1, trainingHours: 1, visibleChampions: false, name: "broadRollout" };
  },
  activityOnly(team) {
    return team.codingActivity >= 0.68
      ? { seatRate: 0.78, trainingHours: 1.5, visibleChampions: false, name: "activityOnly" }
      : { seatRate: 0, trainingHours: 0, visibleChampions: false, name: "activityOnly" };
  },
  peerVisibleGate(team) {
    const ready = team.governanceReadiness >= 0.62;
    const hasPull = team.peerExposure >= 0.58 || team.taskFit >= 0.76;
    const activeEnough = team.codingActivity >= 0.5 || team.taskFit >= 0.82;
    if (!ready || !hasPull || !activeEnough) {
      return { seatRate: 0, trainingHours: 0, visibleChampions: false, name: "peerVisibleGate" };
    }
    const seatRate = team.risk === "high" ? 0.45 : 0.68;
    return { seatRate, trainingHours: 2.5, visibleChampions: true, name: "peerVisibleGate" };
  },
};

function activationScore(team, decision) {
  if (decision.seatRate === 0) return 0;
  const championLift = decision.visibleChampions ? 0.11 : 0;
  const trainingLift = Math.min(decision.trainingHours * 0.035, 0.1);
  const riskDrag = team.risk === "high" ? 0.08 : team.risk === "medium" ? 0.03 : 0;
  const score =
    0.22 +
    team.codingActivity * 0.28 +
    team.peerExposure * 0.22 +
    team.taskFit * 0.24 +
    team.governanceReadiness * 0.08 +
    championLift +
    trainingLift -
    riskDrag;
  return Math.max(0, Math.min(score, 0.98));
}

function evaluateTeam(team, decision) {
  const seats = Math.round(team.engineers * decision.seatRate);
  const activation = activationScore(team, decision);
  const retainedSeats = Math.round(seats * activation);
  const monthlyCreditUnits = Math.round(seats * team.tokenBudget * (1 + decision.trainingHours * 0.04));
  const wastedCreditUnits = Math.max(0, monthlyCreditUnits - Math.round(retainedSeats * team.tokenBudget * 0.92));
  const prLift = Math.round(team.baselineMonthlyPrs * 0.24 * activation * team.taskFit);
  const unsupported = seats > 0 && (team.governanceReadiness < 0.62 || (team.risk === "high" && !decision.visibleChampions));
  const paybackDays = retainedSeats > 0 ? Math.round((monthlyCreditUnits / Math.max(prLift, 1)) * 1.8) : 0;
  return {
    id: team.id,
    seats,
    retainedSeats,
    activation: Number(activation.toFixed(3)),
    monthlyCreditUnits,
    wastedCreditUnits,
    prLift,
    underSupportedAdoption: unsupported ? 1 : 0,
    paybackDays,
  };
}

function percentile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function evaluatePolicy(name, route, teams) {
  const teamsOut = teams.map((team) => evaluateTeam(team, route(team)));
  const seats = teamsOut.reduce((sum, row) => sum + row.seats, 0);
  const retainedSeats = teamsOut.reduce((sum, row) => sum + row.retainedSeats, 0);
  const monthlyCreditUnits = teamsOut.reduce((sum, row) => sum + row.monthlyCreditUnits, 0);
  const wastedCreditUnits = teamsOut.reduce((sum, row) => sum + row.wastedCreditUnits, 0);
  const prLift = teamsOut.reduce((sum, row) => sum + row.prLift, 0);
  const underSupportedTeams = teamsOut.reduce((sum, row) => sum + row.underSupportedAdoption, 0);
  const activeTeams = teamsOut.filter((row) => row.seats > 0);
  const activationRate = seats > 0 ? retainedSeats / seats : 0;
  return {
    name,
    seats,
    retainedSeats,
    activationRate: Number(activationRate.toFixed(3)),
    monthlyCreditUnits,
    wastedCreditUnits,
    prLift,
    underSupportedTeams,
    p95PaybackDays: percentile(activeTeams.map((row) => row.paybackDays), 0.95),
    teams: teamsOut,
  };
}

function renderChart(results) {
  const left = 94;
  const top = 94;
  const chartHeight = 292;
  const groupWidth = 258;
  const maxWaste = Math.max(...results.map((result) => result.wastedCreditUnits), 1);
  const maxUnsupported = Math.max(...results.map((result) => result.underSupportedTeams), 1);
  const labels = {
    broadRollout: "broad rollout",
    activityOnly: "activity only",
    peerVisibleGate: "peer-visible gate",
  };
  const bars = results
    .map((result, index) => {
      const x = left + index * groupWidth;
      const retainedHeight = result.activationRate * chartHeight;
      const wasteHeight = (result.wastedCreditUnits / maxWaste) * chartHeight;
      const unsupportedHeight = (result.underSupportedTeams / maxUnsupported) * chartHeight;
      return `
      <g>
        <rect x="${x}" y="${top + chartHeight - retainedHeight}" width="50" height="${retainedHeight}" rx="4" fill="#126e6a"/>
        <rect x="${x + 68}" y="${top + chartHeight - wasteHeight}" width="50" height="${wasteHeight}" rx="4" fill="#8b5cf6"/>
        <rect x="${x + 136}" y="${top + chartHeight - unsupportedHeight}" width="50" height="${unsupportedHeight}" rx="4" fill="#d64a3a"/>
        <text x="${x + 25}" y="${top + chartHeight + 28}" text-anchor="middle" font-size="14" fill="#1f2937">retain</text>
        <text x="${x + 93}" y="${top + chartHeight + 28}" text-anchor="middle" font-size="14" fill="#1f2937">waste</text>
        <text x="${x + 161}" y="${top + chartHeight + 28}" text-anchor="middle" font-size="14" fill="#1f2937">risk</text>
        <text x="${x + 93}" y="${top + chartHeight + 59}" text-anchor="middle" font-size="17" font-weight="700" fill="#111827">${labels[result.name]}</text>
      </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-labelledby="title desc">
  <title id="title">Coding agent rollout gate scorecard</title>
  <desc id="desc">Bar chart comparing retained-seat rate, normalized wasted credits, and unsupported adoption risk for three coding agent rollout policies.</desc>
  <rect width="960" height="540" fill="#f8fafc"/>
  <rect x="34" y="30" width="892" height="478" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="72" y="72" font-size="25" font-weight="700" fill="#0f172a">Coding agent rollout gates</text>
  <text x="72" y="102" font-size="15" fill="#475569">Retained-seat rate should rise while wasted credits and unsupported adoption risk fall.</text>
  <line x1="${left - 24}" y1="${top + chartHeight}" x2="870" y2="${top + chartHeight}" stroke="#94a3b8"/>
  <line x1="${left - 24}" y1="${top}" x2="${left - 24}" y2="${top + chartHeight}" stroke="#94a3b8"/>
  <text x="48" y="${top + 8}" font-size="13" fill="#64748b">1.0</text>
  <text x="56" y="${top + chartHeight + 4}" font-size="13" fill="#64748b">0</text>
  ${bars}
  <g transform="translate(72 474)">
    <rect width="14" height="14" fill="#126e6a"/><text x="22" y="12" font-size="14" fill="#334155">Retained-seat rate</text>
    <rect x="166" width="14" height="14" fill="#8b5cf6"/><text x="188" y="12" font-size="14" fill="#334155">Normalized wasted credits</text>
    <rect x="390" width="14" height="14" fill="#d64a3a"/><text x="412" y="12" font-size="14" fill="#334155">Unsupported teams</text>
  </g>
</svg>`;
}

async function main() {
  const teams = JSON.parse(await fs.readFile(datasetPath, "utf8"));
  const results = Object.entries(policies).map(([name, route]) => evaluatePolicy(name, route, teams));
  const lines = [
    "Coding agent rollout gate experiment",
    `teams=${teams.length}`,
    ...results.map(
      (result) =>
        `${result.name}: seats=${result.seats} retained=${result.retainedSeats} activation=${result.activationRate} monthly_credit_units=${result.monthlyCreditUnits} wasted_credit_units=${result.wastedCreditUnits} pr_lift=${result.prLift} unsupported_teams=${result.underSupportedTeams} p95_payback_days=${result.p95PaybackDays}`,
    ),
  ];
  await fs.writeFile(resultsPath, `${JSON.stringify({ teams: teams.length, results }, null, 2)}\n`);
  await fs.writeFile(outputPath, `${lines.join("\n")}\n`);
  await fs.writeFile(chartPath, renderChart(results));
  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
