/**
 * calendar.js — Crop calendar with planting/harvesting timelines,
 * month navigation, and weather-linked task suggestions.
 *
 * Calendar data covers major Indian/Asian crops with seasonal activities.
 */

/* ---------- Crop calendar data (India-centric) ---------- */
const CROP_CALENDAR = {
  rice: {
    name: "Rice (Dhan)",
    icon: "🌾",
    kharif: {
      sow: { months: [5, 6], label: "Sow seeds", color: "var(--success)" },
      transplant: { months: [6, 7], label: "Transplant seedlings", color: "var(--info)" },
      fertilize: { months: [7, 8], label: "Top-dress nitrogen", color: "var(--secondary)" },
      pest_spray: { months: [7, 8, 9], label: "Monitor & spray for pests", color: "var(--warning)" },
      harvest: { months: [10, 11], label: "Harvest when 80% grains golden", color: "var(--success)" },
    },
  },
  wheat: {
    name: "Wheat (Gehun)",
    icon: "🌿",
    rabi: {
      sow: { months: [10, 11], label: "Sow after rice harvest", color: "var(--success)" },
      irrigate_1: { months: [12], label: "First irrigation (Crown Root Initiation)", color: "var(--info)" },
      irrigate_2: { months: [1], label: "Second irrigation (Tillering)", color: "var(--info)" },
      fertilize: { months: [1], label: "Top-dress nitrogen at tillering", color: "var(--secondary)" },
      irrigate_3: { months: [2], label: "Third irrigation (Flowering)", color: "var(--info)" },
      harvest: { months: [3, 4], label: "Harvest when grains harden", color: "var(--success)" },
    },
  },
  cotton: {
    name: "Cotton (Kapas)",
    icon: "🤍",
    kharif: {
      sow: { months: [5, 6], label: "Sow when soil temp > 25°C", color: "var(--success)" },
      irrigate: { months: [7, 8], label: "Regular irrigation needed", color: "var(--info)" },
      pest_monitor: { months: [7, 8, 9], label: "Bollworm monitoring & IPM", color: "var(--warning)" },
      pick_1: { months: [10], label: "First picking", color: "var(--success)" },
      pick_2: { months: [11, 12], label: "Second/third picking", color: "var(--success)" },
    },
  },
  maize: {
    name: "Maize (Makka)",
    icon: "🌽",
    kharif: {
      sow: { months: [6], label: "Sow at onset of monsoon", color: "var(--success)" },
      fertilize: { months: [7], label: "Top-dress nitrogen at knee height", color: "var(--secondary)" },
      harvest: { months: [9, 10], label: "Harvest when kernels harden", color: "var(--success)" },
    },
  },
  sugarcane: {
    name: "Sugarcane (Ganna)",
    icon: "🪴",
    annual: {
      plant: { months: [1, 2, 3], label: "Plant setts in rows", color: "var(--success)" },
      earthing: { months: [4, 5], label: "Earthing up & gap filling", color: "var(--secondary)" },
      irrigate: { months: [3, 4, 5, 10, 11], label: "Regular irrigation", color: "var(--info)" },
      harvest: { months: [12, 1, 2], label: "Harvest after 12-14 months", color: "var(--success)" },
    },
  },
  soybean: {
    name: "Soybean (Soya)",
    icon: "🫘",
    kharif: {
      sow: { months: [6], label: "Sow with monsoon onset", color: "var(--success)" },
      fertilize: { months: [7], label: "Phosphorus at sowing, Rhizobium inoculant", color: "var(--secondary)" },
      harvest: { months: [9, 10], label: "Harvest when pods turn brown", color: "var(--success)" },
    },
  },
  tea: {
    name: "Tea (Chai)",
    icon: "🍵",
    annual: {
      flush_1: { months: [3, 4, 5], label: "Spring flush — quality plucking", color: "var(--success)" },
      flush_2: { months: [6, 7, 8], label: "Monsoon flush — heavy growth", color: "var(--success)" },
      flush_3: { months: [9, 10], label: "Autumn flush", color: "var(--success)" },
      prune: { months: [12, 1], label: "Winter pruning", color: "var(--secondary)" },
    },
  },
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

/* ---------- Get all tasks for a given month ---------- */
function getTasksForMonth(month, year) {
  const tasks = [];
  for (const [cropId, crop] of Object.entries(CROP_CALENDAR)) {
    for (const [season, activities] of Object.entries(crop.kharif || {})) {
      if (activities.months.includes(month + 1)) {
        tasks.push({
          crop: crop.name,
          icon: crop.icon,
          label: activities.label,
          color: activities.color,
          activity: season,
          cropId,
        });
      }
    }
    for (const [season, activities] of Object.entries(crop.rabi || {})) {
      if (activities.months.includes(month + 1)) {
        tasks.push({
          crop: crop.name,
          icon: crop.icon,
          label: activities.label,
          color: activities.color,
          activity: season,
          cropId,
        });
      }
    }
    for (const [season, activities] of Object.entries(crop.annual || {})) {
      if (activities.months.includes(month + 1)) {
        tasks.push({
          crop: crop.name,
          icon: crop.icon,
          label: activities.label,
          color: activities.color,
          activity: season,
          cropId,
        });
      }
    }
  }
  return tasks;
}

/* ---------- Get upcoming month-level activities ---------- */
function getUpcomingTasks() {
  const tasks = [];
  const now = new Date();

  // The crop database describes activities by month, not by exact day.
  // Present them honestly as this/next/upcoming month instead of inventing dates.
  for (let offset = 0; offset < 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    getTasksForMonth(d.getMonth(), d.getFullYear()).forEach((t) => {
      const key = `${t.cropId}-${t.activity}-${d.getFullYear()}-${d.getMonth()}`;
      tasks.push({
        ...t,
        key,
        monthOffset: offset,
        month: d.getMonth(),
        year: d.getFullYear(),
      });
    });
  }

  return tasks.slice(0, 8);
}

/* ---------- Render calendar grid ---------- */
function renderCalendarGrid(container, month, year) {
  container.innerHTML = "";
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

  // Day headers
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach((name) => {
    const header = document.createElement("div");
    header.className = "cal-day-header";
    header.textContent = name;
    container.appendChild(header);
  });

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day empty";
    container.appendChild(empty);
  }

  // Day cells
  const tasksThisMonth = getTasksForMonth(month, year);

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    const isToday = isCurrentMonth && day === today.getDate();
    const showMonthMarker = day === 1 && tasksThisMonth.length > 0;

    cell.className = `cal-day${isToday ? " today" : ""}${showMonthMarker ? " has-events" : ""}`;
    cell.innerHTML = `
      <span class="cal-day-num">${day}</span>
      ${showMonthMarker ? `<span class="cal-dot" title="Seasonal activities are planned for this month" style="background: ${tasksThisMonth[0].color}"></span>` : ""}
    `;
    container.appendChild(cell);
  }
}

/* ---------- Render upcoming tasks list ---------- */
function renderUpcomingTasks(container) {
  const tasks = getUpcomingTasks();
  container.innerHTML = "";

  if (!tasks.length) {
    container.innerHTML = '<p class="calendar-empty">No seasonal activities found for the next three months.</p>';
    return;
  }

  tasks.forEach((task) => {
    const div = document.createElement("div");
    div.className = "calendar-task";
    const label = task.monthOffset === 0
      ? "This month"
      : task.monthOffset === 1
        ? "Next month"
        : `${SHORT_MONTHS[task.month]} ${task.year}`;
    div.innerHTML = `
      <div class="task-icon" style="background: ${task.color}20; color: ${task.color}">${task.icon}</div>
      <div class="task-body">
        <strong>${task.crop}</strong>
        <span>${task.label}</span>
      </div>
      <span class="task-date">${label}</span>
    `;
    container.appendChild(div);
  });
}

/* ---------- Init calendar ---------- */
export function initCalendar() {
  const grid = document.getElementById("calendar-grid");
  const tasks = document.getElementById("calendar-tasks");
  const monthLabel = document.getElementById("cal-month-label");
  const prevBtn = document.getElementById("btn-cal-prev");
  const nextBtn = document.getElementById("btn-cal-next");

  if (!grid) return;

  function update() {
    if (monthLabel) monthLabel.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
    renderCalendarGrid(grid, currentMonth, currentYear);
    renderUpcomingTasks(tasks);
  }

  prevBtn?.addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    update();
  });

  nextBtn?.addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    update();
  });

  update();
}
