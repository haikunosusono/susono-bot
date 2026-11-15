/**
 * 俳句の裾野 公式X (@haikunosusono) 自動投稿ボット実行スクリプト
 *
 * - postSchedule.js と postTemplates.js を統合
 * - 日本の祝日（固定祝日・ハッピーマンデー・春分の日・秋分の日・振替休日・国民の休日）に加え、
 *   年末年始（12/29〜1/3）などの特別休日（SCHEDULE_CONFIG.specialHolidays）も「土日祝スケジュール」として処理
 * - 1日の名句碑フォールバック上限（1回まで）や25時回のスキップルールを自動適用
 *
 * 【実行例】
 * node susonoBotRunner.js --time 09:00 --date 2026-12-29
 * node susonoBotRunner.js --time 21:50 --held true --participants 8 --ku 16 --topScore 12
 * node susonoBotRunner.js --time 21:50 --held false --meikuCount 0
 *
 * 出典：Gemini の設計（2026-11-15、服部が共有）。組み込みはクラウド側で。
 * 注意（きなこ）：このスクリプトが使う SCHEDULE_CONFIG.specialHolidays の中身（12/29〜1/3 の一覧）と、
 * テンプレートの morning_kadai / day_digest_reminder / night_digest_reminder / feature_intro_light は、
 * 共有された post-schedule / post-templates 側にまだ入っていません。日記にメモしました。
 */

import { SCHEDULE_CONFIG, resolveAfterKukaiAction } from "./postSchedule.js";
import { buildPostText } from "./postTemplates.js";

// ============================================================================
// 1. 日本の祝日・年末年始（特別休日）・土日祝判定ロジック（外部ライブラリ不要）
// ============================================================================

function getNthMonday(year, month, n) {
  const firstDayOfWeek = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const firstMonday = firstDayOfWeek === 1 ? 1 : ((8 - firstDayOfWeek) % 7) + 1;
  return firstMonday + (n - 1) * 7;
}

function getVernalEquinoxDay(year) {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function getAutumnalEquinoxDay(year) {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function getBaseJapaneseHolidays(year) {
  const map = new Map();
  const add = (m, d, name) => {
    const key = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    map.set(key, name);
  };

  add(1, 1, "元日");
  add(2, 11, "建国記念の日");
  add(2, 23, "天皇誕生日");
  add(4, 29, "昭和の日");
  add(5, 3, "憲法記念日");
  add(5, 4, "みどりの日");
  add(5, 5, "こどもの日");
  add(8, 11, "山の日");
  add(11, 3, "文化の日");
  add(11, 23, "勤労感謝の日");

  add(1, getNthMonday(year, 1, 2), "成人の日");
  add(7, getNthMonday(year, 7, 3), "海の日");
  add(9, getNthMonday(year, 9, 3), "敬老の日");
  add(10, getNthMonday(year, 10, 2), "スポーツの日");

  add(3, getVernalEquinoxDay(year), "春分の日");
  add(9, getAutumnalEquinoxDay(year), "秋分の日");

  return map;
}

export function getJapaneseHolidayName(jstYear, jstMonth, jstDay) {
  const baseHolidays = getBaseJapaneseHolidays(jstYear);
  const toKey = (m, d) => `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const mmddKey = toKey(jstMonth, jstDay);
  const yyyymmddKey = `${jstYear}-${mmddKey}`;

  if (baseHolidays.has(mmddKey)) {
    return baseHolidays.get(mmddKey);
  }

  const specialHolidays = SCHEDULE_CONFIG.specialHolidays || {};
  if (specialHolidays[yyyymmddKey]) {
    return specialHolidays[yyyymmddKey];
  }
  if (specialHolidays[mmddKey]) {
    return specialHolidays[mmddKey];
  }

  const targetUtc = new Date(Date.UTC(jstYear, jstMonth - 1, jstDay));
  const dayOfWeek = targetUtc.getUTCDay();

  if (dayOfWeek !== 0) {
    let cursor = new Date(targetUtc.getTime() - 86400000);
    while (cursor.getUTCFullYear() === jstYear) {
      const cKey = toKey(cursor.getUTCMonth() + 1, cursor.getUTCDate());
      const cDow = cursor.getUTCDay();
      if (baseHolidays.has(cKey)) {
        if (cDow === 0) {
          return "振替休日";
        }
        cursor = new Date(cursor.getTime() - 86400000);
      } else {
        break;
      }
    }
  }

  if (dayOfWeek !== 0 && dayOfWeek !== 6) {
    const prev = new Date(targetUtc.getTime() - 86400000);
    const next = new Date(targetUtc.getTime() + 86400000);
    const prevKey = toKey(prev.getUTCMonth() + 1, prev.getUTCDate());
    const nextKey = toKey(next.getUTCMonth() + 1, next.getUTCDate());
    if (baseHolidays.has(prevKey) && baseHolidays.has(nextKey)) {
      return "国民の休日";
    }
  }

  return null;
}

export function getJstDateInfo(dateInput = new Date()) {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: SCHEDULE_CONFIG.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(dateInput).map(({ type, value }) => [type, value])
  );

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const timeStr = `${parts.hour}:${parts.minute}`;

  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const holidayName = getJapaneseHolidayName(year, month, day);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isWeekendOrHoliday = isWeekend || Boolean(holidayName);

  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    timeStr,
    year,
    month,
    day,
    dayOfWeek,
    holidayName,
    isWeekendOrHoliday
  };
}

// ============================================================================
// 2. スケジュール枠とテンプレートのディスパッチャ
// ============================================================================

export function buildScheduledPost({
  now = new Date(),
  overrideTime = null,
  kukaiState = {},
  templateVariables = {}
} = {}) {
  const jst = getJstDateInfo(now);
  const targetTime = overrideTime || jst.timeStr;

  const jobList = jst.isWeekendOrHoliday
    ? SCHEDULE_CONFIG.weekendHolidayJobs
    : SCHEDULE_CONFIG.weekdayJobs;

  const job = jobList.find((item) => item.time === targetTime);
  if (!job) {
    return {
      shouldPost: false,
      reason: `指定時刻 (${targetTime}) に該当する${jst.isWeekendOrHoliday ? "土日祝" : "平日"}ジョブがありません`,
      jst
    };
  }

  const vars = {
    kadai: "柊の花",
    kigoSeason: "初冬",
    url: "https://haikunosusono.web.app",
    startTime: job.targetKukaiSlot || "",
    participantCount: kukaiState.participantCount ?? 0,
    kuCount: kukaiState.kuCount ?? 0,
    topScore: kukaiState.topScore ?? 0,
    meiku: "古池や蛙飛びこむ水の音",
    author: "松尾芭蕉",
    placeA: "深川・採荼庵跡（自然石）",
    placeB: "奥の細道むすびの地（扁平石）",
    featureA: "自然石の素朴な彫り",
    featureB: "なめらかな御影石の彫り",
    ...templateVariables
  };

  switch (job.action) {
    case "post_morning_kadai": {
      const post = buildPostText("morning_kadai", vars);
      return { shouldPost: true, jobId: job.id, category: "morning_kadai", jst, ...post };
    }

    case "post_day_digest_reminder": {
      const post = buildPostText("day_digest_reminder", vars, { slot: "day" });
      return { shouldPost: true, jobId: job.id, category: "day_digest_reminder", jst, ...post };
    }

    case "post_noon_rotation": {
      if (jst.isWeekendOrHoliday) {
        return {
          shouldPost: false,
          jobId: job.id,
          reason: "土日祝・特別休日は昼の定例句会（10・13・15時）のお礼と重なるため12:05枠をスキップ",
          jst
        };
      }
      const rule = SCHEDULE_CONFIG.noonRotationByDayOfWeek[jst.dayOfWeek];
      if (!rule || rule.type === "skip") {
        return { shouldPost: false, jobId: job.id, reason: rule?.reason || "休止枠", jst };
      }
      const post = buildPostText(rule.type, vars, { slot: "day" });
      return { shouldPost: true, jobId: job.id, category: rule.type, jst, ...post };
    }

    case "post_evening_rotation": {
      const rule = SCHEDULE_CONFIG.eveningRotationByDayOfWeek[jst.dayOfWeek];
      const category = rule?.type || "night_digest_reminder";
      const post = buildPostText(category, vars, { slot: "night" });
      return { shouldPost: true, jobId: job.id, category, jst, ...post };
    }

    case "post_reminder_1h": {
      const slotType =
        job.targetKukaiSlot && parseInt(job.targetKukaiSlot, 10) >= 19 ? "night" : "day";
      const post = buildPostText("reminder_1h", vars, { slot: slotType });
      return { shouldPost: true, jobId: job.id, category: "reminder_1h", jst, ...post };
    }

    case "post_kukai_result_or_fallback":
    case "post_kukai_result_only_if_held": {
      const isHeld = Boolean(kukaiState.isHeld && (kukaiState.participantCount ?? 1) > 0);
      const decision = resolveAfterKukaiAction({
        isHeld,
        kukaiSlot: job.targetKukaiSlot,
        meikuPostedTodayCount: kukaiState.meikuPostedTodayCount ?? 0,
        allowMeikuFallback: job.allowMeikuFallback
      });

      if (decision === "skip") {
        return {
          shouldPost: false,
          jobId: job.id,
          reason: `${job.targetKukaiSlot}回は不成立かつ名句碑差し替え対象外（または当日送信済み）のためスキップ`,
          jst
        };
      }

      const slotType =
        job.targetKukaiSlot && parseInt(job.targetKukaiSlot, 10) >= 19 ? "night" : "day";
      const post = buildPostText(decision, vars, { slot: slotType });
      return { shouldPost: true, jobId: job.id, category: decision, jst, ...post };
    }

    default:
      throw new Error(`未定義のアクションです: ${job.action}`);
  }
}

// ============================================================================
// 3. CLI / Cron からの直接実行エントリポイント
// ============================================================================

function parseCliArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith("--")) {
      const name = key.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[name] = val;
    }
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseCliArgs(process.argv);
  const targetDate = args.date ? new Date(`${args.date}T12:00:00+09:00`) : new Date();

  const result = buildScheduledPost({
    now: targetDate,
    overrideTime: args.time || "21:50",
    kukaiState: {
      isHeld: args.held !== "false",
      participantCount: Number(args.participants ?? 6),
      kuCount: Number(args.ku ?? 12),
      topScore: Number(args.topScore ?? 9),
      meikuPostedTodayCount: Number(args.meikuCount ?? 0)
    },
    templateVariables: {
      kadai: args.kadai || "柊の花"
    }
  });

  console.log(JSON.stringify(result, null, 2));
}
