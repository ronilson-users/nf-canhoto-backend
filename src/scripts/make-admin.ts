import 'dotenv/config';
import mongoose from 'mongoose';

const email = process.argv[2]?.toLowerCase();
if (!email) {
  console.error('Uso: npx tsx scripts/make-admin.ts email@exemplo.com');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI!);
const res = await mongoose.connection
  .collection('users')
  .updateOne({ email }, { $set: { role: 'admin' } });
console.log(res.matchedCount ? `✅ ${email} agora é admin` : '❌ Usuário não encontrado');
await mongoose.disconnect();