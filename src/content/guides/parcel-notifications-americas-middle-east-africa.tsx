import Link from "next/link";
import type { GuideMeta } from "./types";

export const meta: GuideMeta = {
  slug: "parcel-notifications-americas-middle-east-africa",
  title: "Parcel notifications in Canada, Latin America, the Middle East and Africa",
  description:
    "Canada works much like the US; elsewhere, alerts come mostly by app or text. What to switch on in each country, and which emails are worth forwarding.",
  published: "2026-10-10",
  updated: "2026-10-10",
  readingMinutes: 8,
  category: "Around the world",
};

export default function Content() {
  return (
    <>
      <p>
        If you live in Canada, getting told about incoming parcels works much
        as it does in the US: several carriers will email you about parcels
        heading to your verified address. Elsewhere in the Americas, the
        Middle East and Africa, recipient programs are rarer, and most of the
        ones that exist notify you in an app or by text message. That still
        leaves useful options, and this guide goes through them country by
        country. No carrier anywhere will show you the parcels for an address
        just because you typed it in; every option below starts with you
        proving who you are, or with a shop passing your details to the
        carrier.
      </p>

      <h2>At a glance</h2>
      <p>
        The last column is what you can collect in one inbox. Programs that
        only send app notifications or texts are still worth turning on, but
        no email tool can see them.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Country</th>
              <th scope="col">What to switch on</th>
              <th scope="col">How you’re matched</th>
              <th scope="col">Emails to forward</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Canada</td>
              <td>Canada Post automatic tracking; FedEx Delivery Manager; UPS My Choice</td>
              <td>Your verified name and address</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>Mexico</td>
              <td>Shop order pages (Mercado Libre, Amazon)</td>
              <td>Your shop account</td>
              <td>Shop emails</td>
            </tr>
            <tr>
              <td>Brazil</td>
              <td>Meu Correios or the Correios app</td>
              <td>Your CPF, when the sender recorded it</td>
              <td>Not confirmed</td>
            </tr>
            <tr>
              <td>Argentina, Chile, Colombia</td>
              <td>Shop order pages; Andreani emails in Argentina</td>
              <td>The email you gave the shop</td>
              <td>Shop and courier emails</td>
            </tr>
            <tr>
              <td>United Arab Emirates</td>
              <td>Emirates Post app; epbox</td>
              <td>Your registered details</td>
              <td>Not confirmed</td>
            </tr>
            <tr>
              <td>Saudi Arabia</td>
              <td>SPL services in Tawakkalna; SPL app</td>
              <td>Your identity and National Address</td>
              <td>No</td>
            </tr>
            <tr>
              <td>Israel</td>
              <td>Israel Post My Post</td>
              <td>The mobile numbers you shop with</td>
              <td>Not confirmed</td>
            </tr>
            <tr>
              <td>Turkey</td>
              <td>e-Devlet customs list; carrier apps</td>
              <td>Your national ID (customs list)</td>
              <td>No</td>
            </tr>
            <tr>
              <td>South Africa, Nigeria, Egypt</td>
              <td>Shop order pages; carrier tracking pages</td>
              <td>Tracking number</td>
              <td>Shop emails</td>
            </tr>
            <tr>
              <td>Kenya</td>
              <td>Posta Kenya MPost (paid)</td>
              <td>Your mobile number</td>
              <td>No: SMS</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Canada</h2>
      <ul>
        <li>
          <strong>Canada Post automatic tracking:</strong> free with a
          personal Canada Post profile. Packages addressed to you, and returns
          you send, are added to your Track list, and you can get
          notifications as they move. Canada Post matches packages using the
          names and address in your profile: you can add up to five versions
          of your name as they’d appear on a label, and you verify with the
          name and address on your government-issued photo ID. Business and PO
          Box addresses aren’t eligible, and Canada Post says it can’t ensure
          every package will be added (see{" "}
          <a href="https://www.canadapost-postescanada.ca/cpc/en/personal/manage-mail/automatic-tracking.page" rel="noopener noreferrer" target="_blank">Canada Post’s automatic tracking page</a>
          ).
        </li>
        <li>
          <strong>FedEx Delivery Manager:</strong> the Canadian residential
          version alerts you about FedEx parcels heading to your home. FedEx
          usually verifies the address automatically through a third-party
          service; if it can’t, it posts you a card with a PIN, and your
          mobile number is confirmed with a texted code (see{" "}
          <a href="https://www.fedex.com/en-ca/delivery-manager/personal.html" rel="noopener noreferrer" target="_blank">FedEx Canada’s page</a>
          ). Our{" "}
          <Link href="/guides/fedex-delivery-manager">Delivery Manager guide</Link>{" "}
          explains the program in more detail.
        </li>
        <li>
          <strong>UPS My Choice:</strong> the free membership lists UPS
          parcels for your address once you enter an activation code that UPS
          posts to you (see{" "}
          <a href="https://www.ups.com/ca/en/track/ups-my-choice" rel="noopener noreferrer" target="_blank">UPS Canada</a>{" "}
          and our <Link href="/guides/ups-my-choice">UPS My Choice guide</Link>
          ).
        </li>
        <li>
          <strong>Purolator, Intelcom and Canpar</strong> have no recipient
          sign-up. You get their emails or texts only when the shop gave them
          your contact details. Purolator’s current emails are bilingual, with
          the English and French subject in a single line.
        </li>
      </ul>
      <p>
        At some addresses, Canada Post’s MyMail service also emails you a
        count of the letters on their way, with the sender’s name where it’s
        known.
      </p>

      <h2>Mexico, Argentina, Chile and Colombia</h2>
      <p>
        We found no program in these countries that lists parcels coming to
        you without a tracking number. What you can do:
      </p>
      <ul>
        <li>
          <strong>Mexico:</strong> Correos de México tracks by guide number
          only and can’t search by name. Estafeta sends text or email alerts
          when the sender switches them on. FedEx Delivery Manager in Latin
          America is turned on by the shipper for each shipment, after which
          FedEx emails or texts you a link; you can’t sign up for it
          yourself.
        </li>
        <li>
          <strong>Argentina:</strong> Andreani emails recipients at each
          stage of a delivery when the shop passes on your email, including a
          message when a parcel is waiting at a branch. Correo Argentino’s app
          tracks by number.
        </li>
        <li>
          <strong>Chile:</strong> Correos de Chile, Chilexpress and Starken
          track by shipment number. Correos de Chile set up a new official
          contact channel in 2023 to counter phishing, so be wary of messages
          claiming to be from it that arrive any other way.
        </li>
        <li>
          <strong>Colombia:</strong> Servientrega, 4-72, Inter Rapidísimo and
          Coordinadora all track by guide number (
          <span lang="es">número de guía</span>).
        </li>
      </ul>
      <p>
        Mercado Libre and Amazon Mexico show your own orders in your account
        and email you as they ship. For most people in these countries, those
        shop emails, plus courier emails such as Andreani’s, are what to
        collect.
      </p>

      <h2>Brazil</h2>
      <p>
        Correios goes further than its neighbours. Sign in to Meu Correios or
        the Correios app and you see items linked to your CPF (or CNPJ, for a
        company), split into in transit and delivered (see{" "}
        <a href="https://www.correios.com.br/atendimento/ferramentas/meu-correios-1" rel="noopener noreferrer" target="_blank">Meu Correios</a>
        ). This only works when the sender recorded your CPF when posting the
        item, and a Correios reply to a customer complaint said it covers
        items posted at the counter, so many online orders won’t appear.
        Registration checks your CPF against Receita Federal records. Imports
        show under “Minhas Importações”, where you may need to declare your
        CPF yourself. The app sends push notifications; we couldn’t confirm
        email alerts.
      </p>
      <p>
        Correios says it only sends email from the{" "}
        <code translate="no">@correios.com.br</code> domain (see{" "}
        <a href="https://www.correios.com.br/central-de-informacoes/boletim-aos-clientes/comunicado-02-2024-alerta-sobre-golpes-digitais-e-falsos-e-mails" rel="noopener noreferrer" target="_blank">its scam warning</a>
        ), and lookalike “customs fee” sites are a common scam. Don’t type
        your CPF into unofficial tracking sites: it identifies you far beyond
        one parcel. Mercado Livre, Amazon.com.br and Shopee emails cover your
        own orders.
      </p>

      <h2>United Arab Emirates and Saudi Arabia</h2>
      <p>
        <strong>United Arab Emirates:</strong> registered users of the
        Emirates Post app get a live timeline of their incoming and outgoing
        shipments (see{" "}
        <a href="https://www.emiratespost.ae/all-services/mobile-app" rel="noopener noreferrer" target="_blank">Emirates Post’s app page</a>
        ). Emirates Post’s epbox service gives you a seven-digit virtual PO
        Box number to use in online orders, with delivery preferences and
        notifications; signing up asks for your full name, Emirates ID
        number, mobile number and email. We couldn’t confirm whether either
        one sends email alerts. Emirates Post says it never asks for card
        details by SMS, WhatsApp or email. Amazon.ae and noon email you about
        your own orders.
      </p>
      <p>
        <strong>Saudi Arabia:</strong> under rules reported to apply from
        January 2026, parcels in, into and out of the Kingdom must carry the
        recipient’s National Address, so make sure your short address is
        saved in every shop account. SPL’s services inside the Tawakkalna app
        let you view, track and check the status of incoming, outgoing and
        completed shipments, and show your National Address (see{" "}
        <a href="https://splonline.com.sa/en/media-center/news/20250320/" rel="noopener noreferrer" target="_blank">SPL’s announcement</a>
        ). The SPL app can link a tracking number to your preferred parcel
        station, and when a parcel arrives there you get a text with the
        location and a PIN. We found no email channel.
      </p>

      <h2>Israel and Turkey</h2>
      <p>
        <strong>Israel:</strong> Israel Post’s free My Post service lists
        parcels coming to you from Israel and abroad. Israel Post has advised
        registering with the same mobile numbers you use when ordering from
        websites, so those shipments appear (see{" "}
        <a href="https://israelpost.co.il/pages/my_post" rel="noopener noreferrer" target="_blank">My Post</a>
        ). You can log in with your ID number or email and a password, with
        Google or Apple, or with a one-time code sent by text. Notifications
        come through the app and by text; we couldn’t confirm an email
        option. Scam messages often use lookalike domains, so only trust
        links on israelpost.co.il.
      </p>
      <p>
        <strong>Turkey:</strong> through e-Devlet, the government portal, you
        can see international postal and cargo items held at customs in your
        name, along with the customs office and any steps you need to take.
        Logging in needs your national ID number and an e-Devlet password or
        e-signature. Domestic parcels are tracked by barcode or tracking
        number with PTT, Aras or Yurtiçi, and Yurtiçi’s app reportedly shows
        recent cargo coming to you after you log in. MNG Kargo now operates
        as DHL eCommerce Türkiye. The Ministry of Trade warns that it doesn’t
        ask for customs payments by email, text message or link.
      </p>

      <h2>South Africa, Nigeria, Kenya and Egypt</h2>
      <ul>
        <li>
          <strong>South Africa:</strong> we found no recipient program. The
          South African Post Office has spent years in business rescue and
          closed many branches, so many shops ship with private couriers such
          as The Courier Guy, and pickup networks such as Pargo text you when
          a parcel is ready. Takealot keeps you updated about your own orders
          by email, text and app.
        </li>
        <li>
          <strong>Nigeria:</strong> GIG Logistics lets you look up shipments
          by waybill or mobile number, with alerts in its GIGGo app. We
          haven’t found a recipient program from NIPOST.
        </li>
        <li>
          <strong>Kenya:</strong> Posta Kenya’s MPost turns your mobile number
          into a virtual PO Box. You choose a post office, and when a letter or
          parcel arrives there you get a text and about a week to collect it.
          It costs an annual fee (KSh 2,000 a year for individuals in 2024),
          and doorstep delivery costs extra.
        </li>
        <li>
          <strong>Egypt:</strong> we found no recipient program from Egypt
          Post or the large local couriers. You track by number, and the
          shop’s own emails and texts are the main source of updates.
        </li>
      </ul>

      <h2>Keep your ID numbers to yourself</h2>
      <p>
        Several countries in this guide use national identifiers to match
        parcels: the CPF in Brazil, the Emirates ID in the UAE, the national
        ID number in Turkey and Israel, and the National Address in Saudi
        Arabia. Enter them only in the carrier’s or government’s own app or
        website. A third-party site that offers to find your parcels if you
        type in your ID number is, at best, collecting data it doesn’t need,
        and a text that asks for it to “release” a parcel is a scam. Our{" "}
        <Link href="/guides/fake-delivery-text-scams">guide to fake delivery texts</Link>{" "}
        shows the usual patterns.
      </p>

      <h2>Putting it all in one place</h2>
      <p>
        <span translate="no">Package Radar</span> works from email: you add
        one filter that forwards carrier and shop notices to a personal{" "}
        <span translate="no">Package Radar</span> address, and we turn them
        into one list of what’s on the way. We never ask for your CPF,
        Emirates ID or any other ID number.
      </p>
      <ul>
        <li>
          <strong>In Canada,</strong> switch on the three programs above with
          email alerts and forward them, along with Purolator and Intelcom
          emails. English and French messages both work.
        </li>
        <li>
          <strong>Elsewhere,</strong> forward shop shipping emails (Amazon,
          Mercado Libre, noon, Takealot and others) and courier emails that
          arrive because the shop shared your email, such as Andreani’s or
          DHL Express’s. Spanish, Portuguese, Arabic, Hebrew and Turkish
          emails are fine to forward, although for some carriers we can only
          pick out the tracking number and a basic status.
        </li>
        <li>
          <strong>Not reachable:</strong> app notifications and text
          messages, which is how most programs outside Canada notify you.
        </li>
      </ul>
      <p>
        From each email we keep only the carrier, the tracking or order
        number, the sender, the status and the dates. We don’t store what you
        ordered, because item names can reveal more than you’d want. The{" "}
        <Link href="/setup">setup</Link> shows which services cover your
        country. For how carrier programs work in general, see our guide to{" "}
        <Link href="/guides/how-to-see-every-package-coming-to-your-address">seeing every package coming to your address</Link>
        , and if a parcel has gone quiet, see{" "}
        <Link href="/guides/track-a-package-without-a-tracking-number">what still works without a tracking number</Link>
        .
      </p>
    </>
  );
}
