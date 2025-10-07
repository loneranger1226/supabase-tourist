import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions";

export async function AuthButton() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return user ? (
    <form action={logout} className="flex items-center gap-4">
      Hey, {user.email}!
      <Button type="submit" size="sm" variant={"outline"}>退出登录</Button>
    </form>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">登录</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">注册</Link>
      </Button>
    </div>
  );
}
