const { admin, db } = require('../config');
const { getBot } = require('./bot');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function grantChannelAccess(studentId, courseId) {
  const bot = getBot();
  if (!bot) {
    console.warn('Telegram bot not available');
    return null;
  }

  // Fetch student
  const studentDoc = await db.collection('students').doc(studentId).get();
  if (!studentDoc.exists) {
    console.warn(`Student ${studentId} not found`);
    return null;
  }
  const student = studentDoc.data();

  // If no telegramUserId, store pending flag
  if (!student.telegramUserId) {
    console.log(`Student ${studentId} has no Telegram linked, storing pending flag`);
    const existingEnroll = await db.collection('enrollments')
      .where('studentId', '==', studentId)
      .where('courseId', '==', courseId)
      .limit(1)
      .get();

    if (!existingEnroll.empty) {
      await existingEnroll.docs[0].ref.update({
        telegramInviteLink: null,
        telegramPending: true,
      });
    }
    return null;
  }

  // Fetch course for channel ID
  const courseDoc = await db.collection('courses').doc(courseId).get();
  if (!courseDoc.exists) {
    console.warn(`Course ${courseId} not found`);
    return null;
  }
  const course = courseDoc.data();

  if (!course.telegramChannelId) {
    console.warn(`Course ${courseId} has no Telegram channel configured`);
    return null;
  }

  // Create invite link (48h expiry, single use)
  try {
    const inviteLink = await bot.createChatInviteLink(course.telegramChannelId, {
      name: `Student: ${studentId.substring(0, 10)}`,
      member_limit: 1,
      expire_date: Math.floor(Date.now() / 1000) + 48 * 3600,
    });

    // Send invite to student
    try {
      await bot.sendMessage(
        student.telegramUserId,
        `🎨 You've been enrolled in *${course.title}*!\n\nClick the link below to join the private course channel (expires in 48 hours):\n${inviteLink.invite_link}`,
        { parse_mode: 'Markdown' },
      );
    } catch (msgErr) {
      console.error(`Failed to send Telegram message to ${student.telegramUserId}:`, msgErr);
    }

    return inviteLink.invite_link;
  } catch (err) {
    console.error(`Failed to create invite link for course ${courseId}:`, err);
    return null;
  }
}

async function grantAccessToAllEnrolled(studentId) {
  const enrollmentsSnap = await db.collection('enrollments')
    .where('studentId', '==', studentId)
    .where('telegramInviteLink', '==', null)
    .get();

  if (enrollmentsSnap.empty) return;

  for (const doc of enrollmentsSnap.docs) {
    const data = doc.data();
    try {
      const link = await grantChannelAccess(studentId, data.courseId);
      if (link) {
        await doc.ref.update({ telegramInviteLink: link });
      }
      await delay(500); // Rate limit: 2 requests/sec max
    } catch (err) {
      console.error(`Failed to grant access for course ${data.courseId}:`, err);
    }
  }
}

async function revokeChannelAccess(studentId, courseId) {
  const bot = getBot();
  if (!bot) return;

  const studentDoc = await db.collection('students').doc(studentId).get();
  if (!studentDoc.exists) return;
  const student = studentDoc.data();

  if (!student.telegramUserId) return;

  const courseDoc = await db.collection('courses').doc(courseId).get();
  if (!courseDoc.exists) return;
  const course = courseDoc.data();

  if (!course.telegramChannelId) return;

  try {
    await bot.banChatMember(course.telegramChannelId, parseInt(student.telegramUserId));
    await bot.unbanChatMember(course.telegramChannelId, parseInt(student.telegramUserId));
    await bot.sendMessage(
      student.telegramUserId,
      `Your access to *${course.title}* has been removed.`,
      { parse_mode: 'Markdown' },
    );
  } catch (err) {
    console.error(`Failed to revoke access for student ${studentId} in course ${courseId}:`, err);
  }
}

async function sendBroadcast(courseId, message) {
  const bot = getBot();
  if (!bot) return { sent: 0, failed: 0 };

  const enrollmentsSnap = await db.collection('enrollments')
    .where('courseId', '==', courseId)
    .get();

  let sent = 0;
  let failed = 0;

  for (const doc of enrollmentsSnap.docs) {
    const data = doc.data();
    const studentDoc = await db.collection('students').doc(data.studentId).get();
    if (!studentDoc.exists) continue;

    const student = studentDoc.data();
    if (!student.telegramUserId) {
      failed++;
      continue;
    }

    try {
      await bot.sendMessage(student.telegramUserId, message, { parse_mode: 'Markdown' });
      sent++;
      await delay(500);
    } catch (err) {
      console.error(`Broadcast failed for ${student.telegramUserId}:`, err);
      failed++;
    }
  }

  return { sent, failed };
}

module.exports = {
  grantChannelAccess,
  grantAccessToAllEnrolled,
  revokeChannelAccess,
  sendBroadcast,
};
