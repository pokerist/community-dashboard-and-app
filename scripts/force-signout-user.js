const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node scripts/force-signout-user.js <email>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true, sessionVersion: true },
    });

    if (!user) {
      console.log(`User not found: ${email}`);
      return;
    }

    const [revoked] = await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revoked: false },
        data: { revoked: true },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { sessionVersion: { increment: 1 } },
      }),
    ]);

    console.log(
      `Signed out ${user.email}: revoked ${revoked.count} refresh token(s), incremented sessionVersion.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
