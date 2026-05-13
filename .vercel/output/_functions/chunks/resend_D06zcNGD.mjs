const POST = async ({ request, locals, redirect }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();
  if (!email) {
    return redirect("/login?error=Email is required to resend confirmation");
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return redirect("/login?error=Please enter a valid email address");
  }
  const { error } = await locals.supabase.auth.resend({
    type: "signup",
    email
  });
  if (error) {
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes("too many requests")) {
      return redirect("/login?error=Too many requests. Please wait a moment before trying again.");
    }
    if (errorMessage.includes("email not found") || errorMessage.includes("not found")) {
      return redirect("/login?error=No account found with this email");
    }
    return redirect(`/login?error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email)}`);
  }
  return redirect("/login?message=Confirmation email resent. Please check your inbox.&email=" + encodeURIComponent(email));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
