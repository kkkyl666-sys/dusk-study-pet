// This entry has no sync configuration and never reads the personal storage keys.
window.PET_DEMO = true;
// Capture before startup creates a default snapshot; existing learners skip onboarding.
window.PET_SHARE_EXISTING = true;
try {
  window.PET_SHARE_EXISTING = Object.keys(localStorage).some(key => key.startsWith('dusk-demo-v1:') &&
    /(?:full-state|english|resume|draft|summer-study)/.test(key));
} catch { /* Do not interrupt existing work when storage is unavailable. */ }
try {
  const saved = JSON.parse(localStorage.getItem("dusk-demo-v1:dusk-study-pet-full-state-v1") || "null");
  const date = new Date(saved?.shareCalendar + "T00:00:00");
  if (saved?.shareCalendar && !isNaN(date) && date.getDay() === 1) window.PET_SHARE_CALENDAR = saved.shareCalendar;
} catch { /* Existing stores remain untouched if recovery is needed. */ }
window.createDemoData = function(mode) {
  const names = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
  const courseNames = ["学术英语", "高等数学", "程序设计", "设计与表达", "自然科学导论", "体育活动", "文学与生活"];
  const tasks = [["09:00 阅读与笔记", "学习", "整理一页读书笔记。"], ["16:30 散步", "恢复", "出去走走，给眼睛放个假。"], ["19:30 项目练习", "规划", "完成一个小步骤。"]];
  const selectedCourses = [];
  const days = names.map((name, day) => {
    if (mode !== "blank") {
      const start = [1, 3, 5, 7][Math.floor(Math.random() * 4)];
      selectedCourses.push({code:"示例",name:courseNames[day],type:day % 2 ? "major" : "public",weeks:[[1,20]],day,periods:[start,start+1],room:`示例教室 ${day+1}01`,teacher:"示例教师"});
    }
    return {date:name,name,line:"今天，也慢慢来。",tasks:mode === "blank" ? [] : [structuredClone(tasks[Math.floor(Math.random()*tasks.length)])]};
  });
  return {selectedCourses,days};
};
