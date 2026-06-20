const { Bot, Keyboard, InlineKeyboard } = require("grammy");
const cron = require("node-cron");
const https = require("https");
const {
    initDB,
    addJob,
    getUnpublishedJobs,
    publishJob,
    deleteJob,
    getPublishedJobs,
    getResume,
    saveResume,
    getSubscriptions,
    addSubscription,
    removeSubscription,
    sendToChannel
} = require("./database");

// 🔥 ВАШ ТОКЕН БОТА
const TOKEN = "8761305853:AAER4h0CUKwlRd_C_6pNgTeErnJhZbjrFwg";

// 🔥 ВАШ ЛИЧНЫЙ ID (из userinfobot)
const ADMIN_CHAT_ID = 5503778921;

// 🔥 ID ВАШЕГО КАНАЛА (цифровой или @username)
const CHANNEL_ID = "-1004423881440"; 

const bot = new Bot(TOKEN);

// ==========================================
// САМОПИНГ (КАЖДЫЕ 5 МИНУТ)
// ==========================================
cron.schedule("*/5 * * * *", async () => {
    console.log("🔄 Пинг: держим бота живым...");
    try {
        const url = `https://${process.env.RENDER_EXTERNAL_URL || 'your-app.onrender.com'}`;
        https.get(url, (res) => console.log(`📡 Ответ ${res.statusCode}`)).on('error', () => {});
    } catch (e) {}
});

// ==========================================
// ОБРАБОТЧИК ОШИБОК
// ==========================================
bot.catch((err) => console.error("❌ Ошибка бота:", err));

// ==========================================
// СТАРТ / МЕНЮ
// ==========================================
bot.command("start", (ctx) => {
    ctx.reply("🚀 <b>Поиск работы в городе!</b>\n\n" +
        "🔍 <b>Как это работает:</b>\n" +
        "1. Создайте резюме за 30 секунд (/resume)\n" +
        "2. Листайте вакансии в стиле Tinder (/find)\n" +
        "3. Откликайтесь одной кнопкой!\n" +
        "4. Подпишитесь на новые вакансии (/subscribe)",
        {
            parse_mode: "HTML",
            reply_markup: new Keyboard()
                .text("🔍 Искать вакансии").row()
                .text("📄 Моё резюме").row()
                .text("🔔 Подписаться").row()
                .text("📦 Добавить вакансию (для работодателей)")
                .resized()
        }
    );
});

// ==========================================
// ПОИСК ВАКАНСИЙ (СВАЙП-СТИЛЬ)
// ==========================================
bot.command("find", async (ctx) => {
    const userId = ctx.from.id;
    const resume = await getResume(userId);
    if (!resume) {
        return ctx.reply("⚠️ Сначала создайте резюме через /resume!");
    }

    const jobs = await getPublishedJobs(20);
    if (jobs.length === 0) {
        return ctx.reply("😔 Пока нет вакансий. Подпишитесь, и я пришлю уведомление!");
    }

    if (!ctx.session) ctx.session = {};
    ctx.session.jobs = jobs;
    ctx.session.currentIndex = 0;

    await showJob(ctx);
});

async function showJob(ctx) {
    const session = ctx.session;
    if (!session || session.currentIndex >= session.jobs.length) {
        await ctx.reply("🎉 Вы просмотрели все вакансии! Хотите начать заново? /find");
        return;
    }

    const job = session.jobs[session.currentIndex];
    const keyboard = new InlineKeyboard()
        .text("👎 Пропустить", `skip_${session.currentIndex}`).row()
        .text("👍 Откликнуться", `apply_${job.id}`);

    await ctx.reply(
        `📌 <b>${job.title}</b>\n\n` +
        `🏢 Компания: ${job.company}\n` +
        `💰 Зарплата: ${job.salary}\n` +
        `📍 Город: ${job.city}\n` +
        `📝 Описание:\n${job.description}\n\n` +
        `📞 Контакт: ${job.contact}`,
        { parse_mode: "HTML", reply_markup: keyboard }
    );
}

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;

    if (data.startsWith("skip_")) {
        const nextIndex = parseInt(data.split("_")[1]) + 1;
        ctx.session.currentIndex = nextIndex;
        await ctx.answerCallbackQuery("👎 Пропущено");
        return showJob(ctx);
    }

    if (data.startsWith("apply_")) {
        const jobId = data.split("_")[1];
        const resume = await getResume(userId);
        
        await ctx.answerCallbackQuery("👍 Отклик отправлен!");
        await ctx.reply(
            `✅ <b>Вы откликнулись на вакансию!</b>\n\n` +
            `Ваше резюме отправлено работодателю.\n\n` +
            `📌 <b>Ваши данные:</b>\n` +
            `Имя: ${resume.name}\n` +
            `Навыки: ${resume.skills}\n` +
            `Телефон: ${resume.phone}`,
            { parse_mode: "HTML" }
        );
    }
});

// ==========================================
// РЕЗЮМЕ
// ==========================================
bot.command("resume", async (ctx) => {
    const resume = await getResume(ctx.from.id);
    if (resume) {
        ctx.reply(
            `📄 <b>Ваше резюме:</b>\n\n` +
            `Имя: ${resume.name}\n` +
            `Опыт: ${resume.experience}\n` +
            `Навыки: ${resume.skills}\n` +
            `Телефон: ${resume.phone}\n\n` +
            `Чтобы изменить, введите /edit_resume`,
            { parse_mode: "HTML" }
        );
    } else {
        ctx.reply(
            `📄 <b>Создание резюме за 30 секунд</b>\n\n` +
            `Введите данные в формате:\n` +
            `<code>Имя;Опыт;Навыки;Телефон</code>\n\n` +
            `Пример:\n` +
            `<code>Иван Иванов;3 года в продажах;CRM, переговоры;+79991234567</code>`,
            { parse_mode: "HTML" }
        );
    }
});

bot.command("edit_resume", (ctx) => {
    ctx.reply(
        `📄 Введите новые данные в формате:\n` +
        `<code>Имя;Опыт;Навыки;Телефон</code>`,
        { parse_mode: "HTML" }
    );
});

// ==========================================
// ПОДПИСКИ
// ==========================================
bot.command("subscribe", async (ctx) => {
    ctx.reply(
        `🔔 <b>Подписка на новые вакансии</b>\n\n` +
        `Выберите категории (через запятую):\n` +
        `IT, Строительство, Торговля, Водители, Курьеры\n\n` +
        `Пример: <code>IT, Водители</code>\n\n` +
        `Или укажите максимальную зарплату (опционально):\n` +
        `Пример: <code>IT, Водители;100000</code>`,
        { parse_mode: "HTML" }
    );
});

// ==========================================
// ОБРАБОТЧИК ТЕКСТОВЫХ СООБЩЕНИЙ (ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ)
// ==========================================
bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    // --- КНОПКИ МЕНЮ ---
    if (text === "🔍 Искать вакансии") return bot.command("find", ctx);
    if (text === "📄 Моё резюме") return bot.command("resume", ctx);

    // --- ОБРАБОТКА ПОДПИСКИ ---
    if (text.startsWith("🔔") || text.includes("IT") || text.includes("Строительство")) {
        const parts = text.split(";").map(s => s.trim());
        let categories = parts[0];
        let maxSalary = parts[1] || "";
        await addSubscription(userId, categories, maxSalary);
        return ctx.reply("✅ Подписка оформлена! Я уведомлю вас о новых вакансиях.");
    }

    // --- КНОПКА ДОБАВЛЕНИЯ ВАКАНСИИ ---
    if (text === "📦 Добавить вакансию (для работодателей)") {
        return ctx.reply(
            `📦 <b>Добавление вакансии</b>\n\n` +
            `Введите данные в формате:\n` +
            `<code>Название;Компания;Описание;Зарплата;Город;Категория;Контакт</code>\n\n` +
            `Пример:\n` +
            `<code>Водитель-курьер;ООО Доставка;Срочно нужен водитель;70000;Москва;Курьеры;+79991112233</code>`,
            { parse_mode: "HTML" }
        );
    }

    // --- ОБРАБОТКА РЕЗЮМЕ (4 поля) И ВАКАНСИЙ (от 7 полей) ---
    if (text.includes(";")) {
        const parts = text.split(";").map(s => s.trim()).filter(s => s.length > 0);
        
        // 1. Если ровно 4 поля — это резюме
        if (parts.length === 4) {
            const [name, experience, skills, phone] = parts;
            await saveResume(userId, { name, experience, skills, phone });
            return ctx.reply("✅ Резюме сохранено! Теперь ищите вакансии через /find");
        }

        // 2. Если 7 или более полей — это вакансия (берём первые 7)
        if (parts.length >= 7) {
            const [title, company, description, salary, city, category, contact] = parts.slice(0, 7);
            const job = await addJob({ title, company, description, salary, city, category, contact });
            
            // Отправка админу с обработкой ошибок
            try {
                const sentMsg = await bot.api.sendMessage(
                    ADMIN_CHAT_ID,
                    `🛡️ <b>НОВАЯ ВАКАНСИЯ НА ПРОВЕРКУ!</b>\n\n` +
                    `📌 Название: ${job.title}\n🏢 Компания: ${job.company}\n💰 Зарплата: ${job.salary}\n📍 Город: ${job.city}\n📝 Описание: ${job.description.substring(0, 100)}...`,
                    { parse_mode: "HTML" }
                );
                console.log("✅ Уведомление админу успешно отправлено!");
            } catch (err) {
                console.error("❌ Ошибка при отправке админу:", err.message);
            }

            return ctx.reply("✅ Вакансия отправлена на проверку администратору. Мы опубликуем её в ближайшее время.");
        } else {
            return ctx.reply("⚠️ Ошибка формата! Для резюме нужно 4 поля, для вакансии 7 полей через точку с запятой.");
        }
    }
});

// ==========================================
// АДМИН-ПАНЕЛЬ И ПУБЛИКАЦИЯ В КАНАЛ
// ==========================================
bot.command("moderate", async (ctx) => {
    if (ctx.from.id !== ADMIN_CHAT_ID) return ctx.reply("⛔ У вас нет прав администратора.");

    const jobs = await getUnpublishedJobs();
    if (jobs.length === 0) {
        return ctx.reply("✅ Нет новых вакансий на проверку.");
    }

    let message = "🛡️ <b>Ожидают проверки:</b>\n\n";
    jobs.forEach((job, i) => {
        message += `🔹 ${i+1}. <b>${job.title}</b>\n`;
        message += `   🏢 ${job.company} | 💰 ${job.salary}\n\n`;
    });

    const keyboard = new InlineKeyboard()
        .text("✅ Опубликовать", `publish_${jobs[0].id}`)
        .text("❌ Удалить", `delete_${jobs[0].id}`);

    ctx.reply(message, { parse_mode: "HTML", reply_markup: keyboard });
});

bot.on("callback_query:data", async (ctx) => {
    if (ctx.from.id !== ADMIN_CHAT_ID) return;

    const data = ctx.callbackQuery.data;
    
    if (data.startsWith("publish_")) {
        const id = data.split("_")[1];
        // 1. Публикуем в базе
        await publishJob(id);
        // 2. Получаем данные вакансии
        const jobs = await getPublishedJobs(20);
        const publishedJob = jobs.find(j => j.id == id);
        
        // 3. Отправляем в канал
        if (publishedJob) {
            await sendToChannel(bot, publishedJob, CHANNEL_ID);
        }

        await ctx.answerCallbackQuery("✅ Опубликовано!");
        await ctx.reply("✅ Вакансия опубликована в базе и отправлена в канал.");
    } 
    else if (data.startsWith("delete_")) {
        const id = data.split("_")[1];
        await deleteJob(id);
        await ctx.answerCallbackQuery("❌ Удалено!");
        await ctx.reply("❌ Вакансия удалена.");
    }
});

// ==========================================
// ЗАПУСК БОТА И СЕРВЕР
// ==========================================
(async function run() {
    await initDB();
    bot.start();
    console.log("✅ Бот вакансий запущен!");

    const express = require('express');
    const app = express();
    const PORT = process.env.PORT || 3000;
    app.get('/', (req, res) => res.send('Job bot is running!'));
    app.listen(PORT, () => console.log(`🌐 Порт ${PORT} открыт`));
})();
