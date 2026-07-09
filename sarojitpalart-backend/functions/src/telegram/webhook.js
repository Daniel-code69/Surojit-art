const express = require('express');
const { admin, db, config } = require('../config');
const { getBot } = require('./bot');
const telegramService = require('./service');

const router = express.Router();

// POST /telegram/webhook - Receives Telegram updates
router.post('/webhook/:secret', async (req, res) => {
  try {
    // Validate secret token header
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (secret !== config.telegram.webhookSecret) {
      return res.status(403).send('Forbidden');
    }

    const update = req.body;
    const bot = getBot();
    if (!bot) {
      return res.status(200).json({ status: 'ok' });
    }

    // Handle message
    if (update.message && update.message.text) {
      await handleMessage(update.message, bot);
    }

    // Handle callback queries
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, bot);
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    res.status(200).json({ status: 'ok' });
  }
});

async function handleMessage(message, bot) {
  const chatId = message.chat.id;
  const text = message.text.trim();
  const from = message.from;
  const telegramUserId = String(from.id);
  const telegramUsername = from.username || null;

  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const payload = parts[1] || '';

    if (payload.startsWith('verify_')) {
      const studentId = payload.replace('verify_', '');

      // Look up student
      const studentDoc = await db.collection('students').doc(studentId).get();
      if (!studentDoc.exists) {
        await bot.sendMessage(chatId, '❌ Verification link is invalid. Please try logging in and connecting again.');
        return;
      }

      // Save Telegram info on student doc
      await db.collection('students').doc(studentId).update({
        telegramUserId,
        telegramUsername,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Grant access to all enrolled courses
      try {
        await telegramService.grantAccessToAllEnrolled(studentId);
      } catch (err) {
        console.error('Failed to grant access after Telegram connect:', err);
      }

      await bot.sendMessage(
        chatId,
        '✅ *Telegram Linked Successfully!*\n\nYour Telegram account is now connected to Sarojit Pal Art. You\'ll receive channel invites for your enrolled courses shortly.\n\nUse /mychannels to see your courses.\nUse /help for help.',
        { parse_mode: 'Markdown' },
      );
    } else {
      await bot.sendMessage(
        chatId,
        '🎨 *Welcome to Sarojit Pal Art Bot!*\n\nI\'ll help you access your course materials and private Telegram channels.\n\n• After enrolling in a course, use /start to connect your account\n• Use /mychannels to see your enrolled courses\n• Use /help for help',
        { parse_mode: 'Markdown' },
      );
    }
  } else if (text === '/mychannels') {
    // Find student by telegramUserId
    const studentsSnap = await db.collection('students')
      .where('telegramUserId', '==', telegramUserId)
      .limit(1)
      .get();

    if (studentsSnap.empty) {
      await bot.sendMessage(chatId, '❌ No account linked. Please log in to the website and connect your Telegram from your profile settings.');
      return;
    }

    const student = studentsSnap.docs[0].data();
    const courseIds = student.enrolledCourseIds || [];

    if (courseIds.length === 0) {
      await bot.sendMessage(chatId, 'You are not enrolled in any courses yet. Visit https://sarojitpalart.com to browse courses!');
      return;
    }

    let msg = '*Your Enrolled Courses:*\n\n';
    for (const courseId of courseIds) {
      const courseDoc = await db.collection('courses').doc(courseId).get();
      if (courseDoc.exists) {
        msg += `• ${courseDoc.data().title}\n`;
      }
    }
    msg += '\nVisit the website to access video lessons!';

    await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
  } else if (text === '/help') {
    await bot.sendMessage(
      chatId,
      '📖 *Help*\n\n/start - Connect your account or see welcome message\n/mychannels - List your enrolled courses\n/help - Show this help\n\nNeed assistance? Visit https://sarojitpalart.com or email palsorojit194@gmail.com',
      { parse_mode: 'Markdown' },
    );
  } else {
    await bot.sendMessage(
      chatId,
      'I didn\'t understand that. Use /help to see available commands.',
    );
  }
}

async function handleCallbackQuery(callbackQuery, bot) {
  // Placeholder for future callback query handling
  await bot.answerCallbackQuery(callbackQuery.id, { text: 'Processing...' });
}

module.exports = router;
