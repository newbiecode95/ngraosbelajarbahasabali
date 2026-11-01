import { getAuth } from '@/server/auth';
import { route } from '@/server/http';
import { demoOnly } from '@/server/config';
import { AppError } from '@/server/errors';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function handler(request:Request) {
  if(demoOnly())throw new AppError(403,'DEMO_ONLY','Saat ini Ngraos memakai profil demo. Isi nama untuk masuk ke desa.');
  return getAuth().handler(request);
}
export async function GET(request:Request) {return route(request,()=>handler(request));}
export async function POST(request:Request) {return route(request,()=>handler(request));}
