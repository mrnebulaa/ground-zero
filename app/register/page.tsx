import AuthPanel from "@/app/account/auth-panel";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <AuthPanel
      mode="register"
      registrationEnabled={process.env.AUTH_REGISTRATION_ENABLED === "true"}
    />
  );
}
