import { getAuth } from '@/server/auth';
import { route } from '@/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {return route(request,()=>getAuth().handler(request));}
export async function POST(request:Request) {return route(request,()=>getAuth().handler(request));}
