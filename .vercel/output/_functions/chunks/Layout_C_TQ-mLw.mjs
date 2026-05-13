import { c as createComponent } from './astro-component_ChyAuDe0.mjs';
import 'piccolore';
import { a3 as addAttribute, bg as renderHead, Q as renderTemplate, C as renderSlot } from './params-and-props_Bdc0UXF-.mjs';
import 'clsx';

const $$Layout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Layout;
  const { title } = Astro2.props;
  const user = Astro2.locals.user;
  const profile = Astro2.locals.profile;
  const isAdmin = profile?.role === "admin";
  const isBanned = profile?.is_banned || false;
  return renderTemplate`<html lang="en"> <head><meta charset="UTF-8"><meta name="description" content="Real-time Chat App"><meta name="viewport" content="width=device-width"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta name="generator"${addAttribute(Astro2.generator, "content")}><title>${title}</title>${renderHead()}</head> <body class="bg-gray-50 text-gray-900 h-screen flex flex-col"> ${isBanned && user ? renderTemplate`<div class="bg-red-600 text-white py-2 px-4 text-center text-sm">
Your account has been banned. Please contact an administrator.
</div>` : null} <nav class="bg-white border-b border-gray-200 sticky top-0 z-50"> <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"> <div class="flex justify-between h-16"> <div class="flex"> <a href="/" class="flex-shrink-0 flex items-center"> <span class="text-xl font-bold text-indigo-600">ChatApp</span> </a> ${user && !isBanned && renderTemplate`<div class="hidden sm:ml-6 sm:flex sm:space-x-8"> <a href="/chat" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Chat</a> <a href="/profile" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Profile</a> ${isAdmin && renderTemplate`<a href="/admin" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium text-purple-600">Admin</a>`} </div>`} </div> <div class="flex items-center"> ${user ? renderTemplate`<div class="flex items-center gap-4"> <span class="text-sm text-gray-500">${user.email}</span> <form action="/api/auth/signout" method="post"> <button type="submit" class="text-sm text-red-600 hover:text-red-800">Sign out</button> </form> </div>` : renderTemplate`<div class="space-x-4"> <a href="/login" class="text-gray-500 hover:text-gray-900">Log in</a> <a href="/signup" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Sign up</a> </div>`} </div> </div> </div> </nav> <main class="flex-1 overflow-hidden flex flex-col"> ${renderSlot($$result, $$slots["default"])} </main> </body></html>`;
}, "C:/Users/Jarvis/Desktop/New folder (2)/chat/src/layouts/Layout.astro", void 0);

export { $$Layout as $ };
