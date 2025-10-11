// @ts-nocheck
import React from 'react';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Fingerprint,
  Globe2,
  MapPin,
  Building2,
  CalendarCheck,
  ShieldAlert,
  Cpu,
  Smartphone,
  KeyRound,
  BellRing,
  Activity,
  Info,
  LockKeyhole,
} from 'lucide-react';
import { useAuth } from './contexts/useAuth';
import { format } from 'date-fns';

const profileBadges = [
  {
    title: 'ISO 27001:2025 შესაბამისობა',
    description: 'ინფორმაციული უსაფრთხოების საერთაშორისო სტანდარტთან შესაბამისი პროფილი.',
    icon: ShieldCheck,
    accent: 'from-[#25D98E]/50 via-transparent to-[#0E1116]/80',
    border: 'border-[#25D98E]/40',
    iconTone: 'text-[#25D98E]',
  },
  {
    title: 'Zero Trust მონიტორინგი',
    description: 'ყველა ავტენტიკაციის მცდელობა რეალურ დროში კონტროლდება.',
    icon: Activity,
    accent: 'from-[#7C6CFF]/40 via-transparent to-[#2C214E]/80',
    border: 'border-[#7C6CFF]/35',
    iconTone: 'text-[#7C6CFF]',
  },
  {
    title: 'გაუმჯობესებული ბიომეტრია',
    description: 'სისტემა მზადაა Passkey/WebAuthn და ბიომეტრიული სექციებისთვის.',
    icon: Fingerprint,
    accent: 'from-[#E14B8E]/40 via-transparent to-[#351D6A]/80',
    border: 'border-[#E14B8E]/35',
    iconTone: 'text-[#E14B8E]',
  },
];

const AdminMyProfile: React.FC = () => {
  const { user, deviceRecognition, deviceTrust } = useAuth();

  const fullName =
    user?.displayName ||
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    'უცნობი მომხმარებელი';

  const primaryEmail = user?.email ?? 'არ არის მითითებული';
  const contactNumber = user?.phoneNumber ?? 'არ არის მითითებული';
  const personalId = user?.personalId ?? 'არ არის მითითებული';
  const roleLabel =
    user?.role === 'SUPER_ADMIN'
      ? 'სუპერ ადმინი'
      : user?.role === 'PROVIDER_ADMIN'
        ? 'პროვაიდერის ადმინი'
        : user?.role === 'PROVIDER'
          ? 'პროვაიდერი'
          : 'კლიენტი';

  const authMethodLabel =
    user?.authMethod === 'webauthn'
      ? 'Passkey (ბიომეტრია)'
      : user?.authMethod === 'fallback'
        ? 'Fallback კოდი'
        : 'ელ.ფოსტა & პაროლი';

  const deviceStatus = deviceRecognition?.isRecognizedDevice
    ? 'დარეგისტრირებული და ნდობით აღჭურვილი'
    : 'ახალი ან დაუმტკიცებელი მოწყობილობა';

  const deviceTrustLabel = deviceTrust ? 'ნდობით აღჭურვილი მოწყობილობა' : 'დაუმტკიცებელი მოწყობილობა';

  const registrationDate = user?.metadata?.creationTime
    ? format(new Date(user.metadata.creationTime), 'yyyy-MM-dd HH:mm')
    : 'მონაცემი არ მოიძებნა';

  const lastSignIn = user?.metadata?.lastSignInTime
    ? format(new Date(user.metadata.lastSignInTime), 'yyyy-MM-dd HH:mm')
    : 'მონაცემი არ მოიძებნა';

  const securityChecklist = [
    {
      title: 'Passkey/WebAuthn',
      description: 'ბიომეტრიული ავტენტიკაცია 2025 წლის მოთხოვნებისთვის.',
      status: user?.authMethod === 'webauthn' ? '✅ გააქტიურებულია' : 'ℹ️ რეკომენდირებულია გააქტიურება',
      icon: KeyRound,
    },
    {
      title: 'Trusted Devices',
      description: 'ნდობით აღჭურვილი მოწყობილობების რეგულარული გადამოწმება.',
      status: deviceTrust ? '✅ ძირითადი მოწყობილობა ნდობით აღჭურვილია' : '⚠️ დაამატეთ ნდობით აღჭურვილი მოწყობილოა',
      icon: Smartphone,
    },
    {
      title: 'სასწრაფო შეტყობინებები',
      description: 'წარუმატებელი ავტენტიკაციის მცდელობების push შეტყობინებები.',
      status: 'ℹ️ იგეგმება ადმინისტრაციის საშუალებით',
      icon: BellRing,
    },
    {
      title: 'Zero Trust წვდომა',
      description: 'დაცვის პოლიტიკა, რომელიც ამოწმებს ყოველ მოთხოვნას.',
      status: '✅ აქტიურია ადმინისტრაციულ სისტემაში',
      icon: ShieldAlert,
    },
  ];

  const identitySummary = [
    { label: 'სრული სახელი', value: fullName, icon: User },
    { label: 'ელ.ფოსტა', value: primaryEmail, icon: Mail },
    { label: 'ტელეფონი', value: contactNumber, icon: Phone },
    { label: 'პირადი ნომერი', value: personalId, icon: Fingerprint },
    { label: 'როლი', value: roleLabel, icon: ShieldCheck },
    { label: 'ავტენტიკაციის მეთოდი', value: authMethodLabel, icon: LockKeyhole },
  ];

  const complianceHighlights = [
    {
      title: 'GDPR/ISO 2025',
      description: 'პირადი მონაცემები დამუშავებულია უმაღლესი სტანდარტებით.',
      icon: Globe2,
    },
    {
      title: 'მოსმენის წინააღმდეგ დაცვა',
      description: 'ყველა კავშირი TLS 1.3+ პროტოკოლით არის დაშიფრული.',
      icon: Cpu,
    },
    {
      title: 'აქტივობის არქივი',
      description: 'შესვლის ისტორია ინახება 12 თვის განმავლობაში.',
      icon: CalendarCheck,
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0E1116] via-[#1B1530] to-[#2C214E] text-[#E6E8EC]">
      <div className="pointer-events-none absolute -left-40 top-32 h-72 w-72 rounded-full bg-[#7C6CFF]/40 blur-[120px]" />
      <div className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-[#25D98E]/30 blur-[110px]" />
      <div className="pointer-events-none absolute bottom-[-120px] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#E14B8E]/25 blur-[140px]" />

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 lg:px-10">
        <div className="flex flex-col gap-16">
          <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#181C2A]/70 p-8 shadow-[0_24px_70px_rgba(6,10,20,0.55)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-40" />
            <div className="relative grid gap-10 lg:grid-cols-[1.6fr,1fr]">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full border border-[#25D98E]/50 bg-[#121622]/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.32em] text-[#25D98E]">
                    ადმინისტრატორის პროფილი
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] font-medium text-[#A0A4AD]">
                    განახლებულია 2025
                  </span>
                </div>
                <div>
                  <h1 className="text-4xl font-semibold tracking-tight text-white lg:text-[42px]">ჩემი პროფილი</h1>
                  <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#A0A4AD]">
                    პერსონალური მონაცემები, უსაფრთხოების სტატუსი და შესაბამისობის მონიტორინგი განახლებულია ბახმაროს ადმინისტრაციული პანელის უახლესი სტანდარტებით.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {identitySummary.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#121622]/80 p-5 shadow-[0_14px_40px_rgba(5,10,20,0.45)] transition duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:scale-[1.02]"
                      >
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                        <div className="relative flex items-start gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/80">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-[13px] uppercase tracking-[0.16em] text-[#A0A4AD]">{item.label}</p>
                            <p className="mt-1 text-base font-medium text-white">{item.value}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="relative overflow-hidden rounded-2xl border border-[#7C6CFF]/40 bg-[#0E1116]/70 p-6 shadow-[0_20px_60px_rgba(6,12,30,0.55)]">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#7C6CFF]/35 via-transparent to-[#351D6A]/40 opacity-80" />
                  <div className="relative space-y-3">
                    <p className="text-[13px] font-medium uppercase tracking-[0.28em] text-[#7C6CFF]">მოწყობილობის სტატუსი</p>
                    <p className="text-xl font-semibold text-white">{deviceStatus}</p>
                    <p className="text-sm text-[#A0A4AD]">{deviceTrustLabel}</p>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-[#25D98E]/40 bg-[#121622]/80 p-6 shadow-[0_18px_55px_rgba(5,14,28,0.5)]">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#25D98E]/30 via-transparent to-[#0E1116]/70" />
                  <div className="relative space-y-3">
                    <p className="text-[13px] font-medium uppercase tracking-[0.24em] text-[#25D98E]">უსაფრთხოების სერთიფიკატი</p>
                    <p className="text-sm leading-6 text-[#A0A4AD]">
                      SOC ოპერაციები აქტიურია და ყველა კრიტიკული ინციდენტი მოდიან თქვენს დაცვის ცენტრში რეალურ დროში.
                    </p>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <ShieldCheck className="h-4 w-4 text-[#25D98E]" />
                      საფრთხეების აღმოჩენა დაჩქარებულია
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <section className="grid gap-8 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-8">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#121622]/80 p-8 shadow-[0_20px_70px_rgba(6,10,24,0.55)] backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-30" />
                <div className="relative grid gap-8 xl:grid-cols-[1.1fr,0.9fr]">
                  <div className="space-y-6">
                    <h2 className="text-2xl font-semibold text-white">უსაფრთხოების პასპორტი</h2>
                    <p className="text-[15px] leading-7 text-[#A0A4AD]">
                      თქვენი პროფილის უსაფრთხოების მახასიათებლები ოპტიმიზებულია 2025 წლის მოთხოვნებისთვის.
                    </p>
                    <div className="space-y-4">
                      {securityChecklist.map((item) => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.title}
                            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0E1116]/60 p-4 transition duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:scale-[1.02]"
                          >
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                            <div className="relative flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/80">
                                  <Icon className="h-5 w-5" />
                                </span>
                                <div>
                                  <p className="text-base font-semibold text-white">{item.title}</p>
                                  <p className="text-sm text-[#A0A4AD]">{item.description}</p>
                                </div>
                              </div>
                              <span className="text-sm font-semibold text-[#7C6CFF]">{item.status}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="relative overflow-hidden rounded-2xl border border-[#7C6CFF]/30 bg-[#0E1116]/70 p-6 shadow-[0_18px_60px_rgba(8,12,26,0.5)]">
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#7C6CFF]/30 via-transparent to-[#351D6A]/50" />
                    <div className="relative space-y-4">
                      <h3 className="text-xl font-semibold text-white">Zero Trust მონიტორინგი</h3>
                      <p className="text-sm leading-6 text-[#A0A4AD]">
                        თითოეული ავტენტიკაციის მოთხოვნა გადის დამატებით ანომალიების ანალიზს და სისტემის მეხსიერებაში ინახება 12 თვე.
                      </p>
                      <div className="space-y-3 text-sm">
                        <p className="flex items-center gap-2 text-[#E6E8EC]">
                          <Fingerprint className="h-4 w-4 text-[#E14B8E]" />
                          Passkey/WebAuthn მზადყოფნა
                        </p>
                        <p className="flex items-center gap-2 text-[#E6E8EC]">
                          <BellRing className="h-4 w-4 text-[#FFC94D]" />
                          შეტყობინებები SOC გუნდთან სინქრონში
                        </p>
                        <p className="flex items-center gap-2 text-[#E6E8EC]">
                          <Cpu className="h-4 w-4 text-[#25D98E]" />
                          ინტელექტუალური მოწყობილობის იდენტიფიკაცია
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-8 lg:grid-cols-2">
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#121622]/80 p-8 shadow-[0_18px_60px_rgba(5,8,20,0.5)]">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-white/5" />
                  <div className="relative space-y-5">
                    <h2 className="text-2xl font-semibold text-white">აქტივობის ისტორია</h2>
                    <p className="text-sm text-[#A0A4AD]">ბოლო ავტენტიკაციები და მოწყობილობის გადააზღვევა.</p>
                    <div className="space-y-4">
                      <div className="rounded-xl border border-white/10 bg-[#0E1116]/70 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#A0A4AD]">ბოლო ავტორიზაცია</p>
                        <p className="mt-2 text-base font-semibold text-white">{lastSignIn}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#0E1116]/70 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#A0A4AD]">პროფილის შექმნის თარიღი</p>
                        <p className="mt-2 text-base font-semibold text-white">{registrationDate}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#0E1116]/70 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#A0A4AD]">მოწყობილობის სტატუსი</p>
                        <p className="mt-2 text-base font-semibold text-white">{deviceStatus}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#121622]/80 p-8 shadow-[0_18px_60px_rgba(5,8,20,0.5)]">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-white/5" />
                  <div className="relative space-y-5">
                    <h2 className="text-2xl font-semibold text-white">ლოკაცია და ინფრასტრუქტურა</h2>
                    <p className="text-sm text-[#A0A4AD]">ძირითადი ოპერირების არეალი და ტექნოლოგიური ფენები.</p>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#0E1116]/70 p-4">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/80">
                          <MapPin className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-[#A0A4AD]">ძირითადი ოპერირების არეალი</p>
                          <p className="mt-2 text-base font-semibold text-white">საქართველო · ბახმარო · თბილისი (SOC)</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#0E1116]/70 p-4">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/80">
                          <Building2 className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-[#A0A4AD]">ინფრასტრუქტურა</p>
                          <p className="mt-2 text-base font-semibold text-white">Google Cloud · Firebase Admin · რეგიონი: europe-west4</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#0E1116]/70 p-4">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/80">
                          <Globe2 className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-[#A0A4AD]">კავშირების შიფრაცია</p>
                          <p className="mt-2 text-base font-semibold text-white">TLS 1.3 · HTTP/3 · მუდმივი მონიტორინგი</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 lg:col-span-4">
              {profileBadges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <div
                    key={badge.title}
                    className={`group relative overflow-hidden rounded-2xl ${badge.border} bg-[#121622]/85 p-[1px] shadow-[0_20px_60px_rgba(6,10,26,0.55)] transition duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:scale-[1.02]`}
                  >
                    <div className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${badge.accent}`} />
                    <div className="relative rounded-[15px] border border-white/10 bg-[#121622]/90 p-6 backdrop-blur-lg">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 ${badge.iconTone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-5 text-lg font-semibold text-white">{badge.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#A0A4AD]">{badge.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#181C2A]/80 p-8 shadow-[0_22px_70px_rgba(6,10,24,0.55)] backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-white/5" />
              <div className="relative space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">ინფორმაციის შესაბამისობა</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[#A0A4AD]">
                      განახლებული მოთხოვნები პირადი მონაცემების დამუშავების, წვდომის კონტროლისა და ზედამხედველობის პროცესისთვის.
                    </p>
                  </div>
                  <Info className="h-8 w-8 text-[#7C6CFF]" />
                </div>

                <div className="space-y-4">
                  {complianceHighlights.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="relative flex items-start gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0E1116]/65 p-4"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/80">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-base font-semibold text-white">{item.title}</p>
                          <p className="text-sm text-[#A0A4AD]">{item.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-[#25D98E]/40 bg-[#0E1116]/70 p-6">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#25D98E]/30 via-transparent to-[#121622]/70" />
                  <div className="relative space-y-2 text-sm text-[#A0A4AD]">
                    <p className="text-[13px] font-semibold uppercase tracking-[0.28em] text-[#25D98E]">აქტიური მონიტორინგი</p>
                    <p className="text-lg font-semibold text-white">ყველა ავტენტიკაციის მცდელობა კონტროლდება SOC პლატფორმით.</p>
                    <p>
                      უსაფრთხოების ოპერაციების ცენტრი რეალურ დროში იღებს შეტყობინებებს საეჭვო ქცევის შესახებ და ინახავს ანალიზის არქივს 12 თვე.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#181C2A]/80 p-8 shadow-[0_22px_70px_rgba(6,10,24,0.55)] backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-white/5" />
              <div className="relative space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-white">დაცული წვდომა</h2>
                  <LockKeyhole className="h-8 w-8 text-[#E14B8E]" />
                </div>
                <p className="text-sm leading-6 text-[#A0A4AD]">
                  Zero Trust პოლიტიკა უზრუნველყოფს, რომ თითოეული მოთხოვნა დაფიქსირებული იყოს და შეამოწმოს როგორც მომხმარებლის იდენტობა, ასევე მოწყობილობის საიმედოობა.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#0E1116]/70 p-4">
                    <KeyRound className="mt-1 h-5 w-5 text-[#E14B8E]" />
                    <div>
                      <p className="text-base font-semibold text-white">ავტენტიკაციის მეთოდი</p>
                      <p className="text-sm text-[#A0A4AD]">{authMethodLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#0E1116]/70 p-4">
                    <Smartphone className="mt-1 h-5 w-5 text-[#25D98E]" />
                    <div>
                      <p className="text-base font-semibold text-white">მოწყობილობის ნდობა</p>
                      <p className="text-sm text-[#A0A4AD]">{deviceTrustLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#0E1116]/70 p-4">
                    <ShieldAlert className="mt-1 h-5 w-5 text-[#FFC94D]" />
                    <div>
                      <p className="text-base font-semibold text-white">Zero Trust კონტროლი</p>
                      <p className="text-sm text-[#A0A4AD]">ყველა მოთხოვნა გადამოწმებულია AI-დაცვის ადაპტიური პოლიტიკებით.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminMyProfile;
