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

// 🔥 ВСТАВЬТЕ СЮДА НОВЫЙ ТОКЕН ОТ BOTFATHER
const TOKEN = "8761305853:AAHqMOxOBpd6QKPWH0Rpx2Nt3jHjh7uhCTU";

// 🔥 ВАШ ЛИЧНЫЙ ID (из userinfobot)
const ADMIN_CHAT_ID = 5503778921;

// 🔥 ID ВАШЕГО КАНАЛА
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
// ВЫНЕСЕННАЯ ЛОГИКА (БЕЗОПАСНЫЙ ВЫЗОВ)
// ==========================================

// --- 1. ПОИСК ВАКАНСИЙ (СВАЙП) ---
async function showJobsList(ctx) {
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
}

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

// --- 2. РЕЗЮМЕ ---
async function showResume(ctx) {
    const resume = await getResume(ctx.from.id);
    if (resume) {
        return ctx.reply(
            `📄 <b>Ваше резюме:</b>\n\n` +
            `Имя: ${resume.name}\n` +
            `Опыт: ${resume.experience}\n` +
            `Навыки: ${resume.skills}\n` +
            `Телефон: ${resume.phone}\n\n` +
            `Чтобы изменить, введите /edit_resume`,
            { parse_mode: "HTML" }
        );
    } else {
        return ctx.reply(
            `📄 <b>Создание резюме за 30 секунд</b>\n\n` +
            `Введите данные в формате:\n` +
            `<code>Имя;Опыт;Навыки;Телефон</code>\n\n` +
            `Пример:\n` +
            `<code>Иван Иванов;3 года в продажах;CRM, переговоры;+79991234567</code>`,
            { parse_mode: "HTML" }
        );
    }
}

// --- 3. ПОДПИСКИ ---
async function showSubscription(ctx) {
    return ctx.reply(
        `🔔 <b>Подписка на новые вакансии</b>\n\n` +
        `Выберите категории (через запятую):\n` +
        `IT, Строительство, Торговля, Водители, Курьеры\n\n` +
        `Пример: <code>IT, Водители</code>\n\n` +
        `Или укажите максимальную зарплату (опционально):\n` +
        `Пример: <code>IT, Водители;100000</code>`,
        { parse_mode: "HTML" }
    );
}

// --- 4. ДОБАВЛЕНИЕ ВАКАНСИИ (Инструкция) ---
async function showAddJobForm(ctx) {
    return ctx.reply(
        `📦 <b>Добавление вакансии</b>\n\n` +
        `Введите данные в формате:\n` +
        `<code>Название;Компания;Описание;Зарплата;Город;Категория;Контакт</code>\n\n` +
        `Пример:\n` +
        `<code>Водитель-курьер;ООО Доставка;Срочно нужен водитель;70000;Москва;Курьеры;+79991112233</code>`,
        { parse_mode: "HTML" }
    );
}

// ==========================================
// КОМАНДЫ БОТА (ТЕПЕРЬ ОНИ БЕЗОПАСНЫ)
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

// Просто привязываем команды к безопасным функциям
bot.command("find", showJobsList);
bot.command("resume", showResume);
bot.command("subscribe", showSubscription);
bot.command("edit_resume", showResume);
bot.command("addjob", showAddJobForm);

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
        await publishJob(id);
        const jobs = await getPublishedJobs(20);
        const publishedJob = jobs.find(j => j.id == id);
        
        // Отправляем в канал ТОЛЬКО ПОСЛЕ НАЖАТИЯ "Опубликовать"
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
// ОБРАБОТЧИК ТЕКСТОВЫХ СООБЩЕНИЙ (БЕЗОПАСНЫЙ)
// ==========================================
bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    // --- КНОПКИ МЕНЮ (БЕЗОПАСНЫЙ ВЫЗОВ) ---
    if (text === "🔍 Искать вакансии") return showJobsList(ctx);
    if (text === "📄 Моё резюме") return showResume(ctx);
    if (text === "🔔 Подписаться") return showSubscription(ctx);
    if (text === "📦 Добавить вакансию (для работодателей)") return showAddJobForm(ctx);

    // --- ОБРАБОТКА ПОДПИСКИ (через текст) ---
    if (text.startsWith("🔔") || text.includes("IT") || text.includes("Строительство")) {
        const parts = text.split(";").map(s => s.trim());
        let categories = parts[0];
        let maxSalary = parts[1] || "";
        await addSubscription(userId, categories, maxSalary);
        return ctx.reply("✅ Подписка оформлена! Я уведомлю вас о новых вакансиях.");
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
                await bot.api.sendMessage(
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
