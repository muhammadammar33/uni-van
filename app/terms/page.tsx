import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms of use", description: `The rules for drivers and riders on ${BRAND.name}.` };

const UPDATED = "15 October 2026";

const S = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-lg font-bold">
      {n}. {title}
    </h2>
    <div className="space-y-2 text-slate-700">{children}</div>
  </section>
);

const L = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="list-disc space-y-1 pl-5">
    {items.map((x, i) => (
      <li key={i}>{x}</li>
    ))}
  </ul>
);

/** Plain-language terms of use, linked from the footer and the ID check. */
export default function TermsPage() {
  return (
    <div className="min-h-dvh pb-16">
      <header className="bg-hero px-4 pb-16 pt-4 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href="/" aria-label="Home">
            <Logo light />
          </Link>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Terms of use</h1>
          <p className="mt-1 text-teal-50/90">The rules for everyone who offers or takes a ride on {BRAND.name}. Last updated {UPDATED}.</p>
        </div>
      </header>
      <main className="mx-auto -mt-10 max-w-2xl px-4">
        <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-white/90 hover:text-white">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <article className="card space-y-6">
          <p className="text-slate-700">
            By offering a ride, booking a seat or sending your ID on {BRAND.domain}, you agree to these terms. Please read them: they are short. How we handle your
            information is explained on the{" "}
            <Link href="/privacy" className="font-semibold text-brand underline">
              privacy page
            </Link>
            .
          </p>

          <S n={1} title="What Hamsafar is">
            <p>
              {BRAND.name} helps people who are already making a trip share the empty seats in their car with others going the same way, and share the cost. We
              connect drivers and riders; we are <b>not</b> a taxi, transport or bus company, we don&apos;t own cars, and drivers don&apos;t work for us. Each ride is
              an arrangement between the driver and the riders.
            </p>
          </S>

          <S n={2} title="Who can use it">
            <L
              items={[
                "Everyone verifies once with a real ID: drivers with their CNIC, driving licence and a selfie; riders with their CNIC and a selfie.",
                "Drivers must be 18 or older. Riders under 18 verify with their B-form and a parent's or guardian's CNIC, and that parent or guardian is responsible for their trips.",
                "Use only your own ID, phone number and details, and keep them true. One person, one registration.",
                "We may refuse a registration, or ask for more information, if something doesn't look right.",
              ]}
            />
          </S>

          <S n={3} title="If you drive">
            <L
              items={[
                "You have a valid driving licence for the car, and the car is registered, roadworthy and insured as the law requires.",
                "You follow traffic laws, never drive after alcohol or drugs, and don't carry more people than the seats you offered and the car's seats allow.",
                "Your listing is honest: the route, time, car, number plate, seats and fare are the real ones, and you respect who it's for (anyone, women only or men only).",
                "At each pickup you tell your riders the ride code, and you start the ride only when they've entered it.",
                "Fares are for sharing the cost of the trip. You are responsible for any permits or taxes the law asks of you.",
              ]}
            />
          </S>

          <S n={4} title="If you ride">
            <L
              items={[
                "Before getting in, ask the driver for the ride code and enter it on your ticket. If it doesn't match, don't get in.",
                "Be at your pickup on time, cancel as early as you can if your plans change, and pay the agreed fare.",
                "Respect the driver, the other riders and the car.",
              ]}
            />
          </S>

          <S n={5} title="Fares and payment">
            <p>
              The driver sets the fare per seat, and riders pay the driver directly (usually in cash), as agreed between them. {BRAND.name} doesn&apos;t handle the
              money and currently charges nothing. If we ever introduce a fee, we&apos;ll say so clearly before it applies.
            </p>
          </S>

          <S n={6} title="Safety">
            <p>
              ID checks, the ride code, live location, &ldquo;Share my trip&rdquo; and ratings make rides safer, but no check can promise how a person will
              behave. Use your own judgement: share your trip with family, sit where you feel comfortable, and don&apos;t continue a ride you feel unsafe in.
            </p>
            <p>
              In an emergency call <b>15</b> (Police) or <b>1122</b> (Rescue) first. Then tell us through{" "}
              <Link href="/feedback" className="font-semibold text-brand underline">
                Feedback
              </Link>{" "}
              (choose &ldquo;Safety&rdquo;). We look at safety reports first, and we share information with the police when the law requires it.
            </p>
          </S>

          <S n={7} title="Not allowed">
            <L
              items={[
                "Fake, borrowed or someone else's ID, and false listings or bookings.",
                "Harassment, threats, abuse or discrimination of any kind.",
                "Carrying illegal or dangerous goods, or using rides to deliver goods for a business.",
                "Asking riders or drivers for money, information or favours beyond the ride.",
                "Fake reviews, spam, or copying data from the site.",
              ]}
            />
          </S>

          <S n={8} title="Ratings and messages">
            <p>
              After a ride, riders can rate the driver. Keep ratings honest and fair. We may hide reviews that are abusive, fake or about something other than the ride.
            </p>
          </S>

          <S n={9} title="When we step in">
            <p>
              We may hide or remove a ride, cancel a booking, or stop someone from using {BRAND.name} if they break these terms, if we receive a serious report about
              them, or to keep others safe. Where it&apos;s safe to, we&apos;ll tell them why.
            </p>
          </S>

          <S n={10} title="Our responsibility">
            <p>
              We work to keep {BRAND.name} running and safe, but it is provided as it is, and rides, times and other people&apos;s details are as given by the people
              who post them. Drivers and riders are responsible for their own conduct and for the ride itself. As far as the law allows, {BRAND.name} isn&apos;t
              responsible for accidents, injury, loss, damage, delays or disputes that happen on or because of a ride arranged between users. Nothing here takes away
              rights that the law doesn&apos;t allow us to limit.
            </p>
          </S>

          <S n={11} title="Changes and law">
            <p>
              We may update these terms; the date at the top shows the latest version, and using {BRAND.name} after a change means you accept it. These terms are
              governed by the laws of Pakistan, and the courts of Islamabad decide any dispute about them.
            </p>
          </S>

          <S n={12} title="Contact">
            <p>
              Questions or problems: send us a message through{" "}
              <Link href="/feedback" className="font-semibold text-brand underline">
                Feedback
              </Link>
              {BRAND.whatsapp && (
                <>
                  {" "}
                  or on WhatsApp at{" "}
                  <a href={`https://wa.me/${BRAND.whatsapp}`} className="font-semibold text-brand underline">
                    +{BRAND.whatsapp}
                  </a>
                </>
              )}
              .
            </p>
          </S>
        </article>
      </main>
    </div>
  );
}
