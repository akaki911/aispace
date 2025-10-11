const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
    <div className="max-w-md space-y-4">
      <h1 className="text-3xl font-semibold">გვერდი ვერ მოიძებნა</h1>
      <p className="text-sm text-slate-300">
        ბმული, რომლითაც სარგებლობთ, არ არსებობს ან დროებით მიუწვდომელია. დაბრუნდით მთავარ გვერდზე და სცადეთ თავიდან.
      </p>
      <a
        href="/"
        className="inline-flex items-center justify-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        მთავარი გვერდი
      </a>
    </div>
  </div>
);

export default NotFound;
