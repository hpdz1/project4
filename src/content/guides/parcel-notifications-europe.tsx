import Link from "next/link";
import type { GuideMeta } from "./types";

export const meta: GuideMeta = {
  slug: "parcel-notifications-europe",
  title: "How to get notified about every parcel coming to you in Europe",
  description:
    "Country by country: which European postal services and couriers list parcels heading to you, how they match you, and how to switch on email alerts.",
  published: "2026-10-10",
  updated: "2026-10-10",
  readingMinutes: 10,
  category: "Around the world",
};

export default function Content() {
  return (
    <>
      <p>
        Nowhere in Europe can you type in an address and see every parcel
        heading there, and no legitimate website offers that. What you can do
        is sign up with the postal service and couriers that deliver to you,
        so that each one tells <em>you</em> about the parcels it’s bringing.
        Most European carriers now have a free app or account that fills up
        with incoming parcels on its own. This guide explains, country by
        country, which services to turn on, how each one recognises your
        parcels, and how to get their alerts by email.
      </p>

      <h2>Two ways European carriers find your parcels</h2>
      <p>
        Before you sign up anywhere, it helps to know which of two approaches
        a carrier uses, because it changes what you need to do.
      </p>
      <ul>
        <li>
          <strong>Matched to your address.</strong> A few services, such as
          Swiss Post, DHL in Germany and PostNL, check that you really live at
          your address, often with a code posted to you, and then list parcels
          addressed to you there. Austrian Post similarly matches the name and
          address on a parcel to your account. This is the closest Europe gets
          to USPS Informed Delivery in the US.
        </li>
        <li>
          <strong>Matched to your email or phone number.</strong> Most
          others, including An Post, InPost, PostNord, Correos and GLS, link
          a parcel to you when the email address or mobile number the shop
          passed to the carrier matches the one in your account. Your address
          usually plays no part.
        </li>
      </ul>
      <p>
        The second kind has a practical consequence: use the same email
        address and mobile number at every checkout as in your carrier
        accounts. If you shop with a work email but registered a personal
        one, those parcels won’t appear. A gift someone else orders for you
        only shows up if they entered your email or number, which gift
        senders often don’t.
      </p>
      <p>
        Many carriers also prefer app notifications to email, so switch
        email on in each app’s settings where it’s offered.
      </p>

      <h2>Quick reference by country</h2>
      <p>
        Everything below is free for people receiving parcels. “Matched by”
        is how the service decides that a parcel is yours.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Country</th>
              <th scope="col">Services worth turning on</th>
              <th scope="col">Matched by</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>United Kingdom</td>
              <td>DPD app, Evri app, UPS My Choice</td>
              <td>Phone or email plus address (DPD); account email (Evri); verified address (UPS)</td>
            </tr>
            <tr>
              <td>Ireland</td>
              <td>An Post My deliveries</td>
              <td>Email or phone</td>
            </tr>
            <tr>
              <td>Germany</td>
              <td>DHL parcel announcement, myDPD, GLS account, UPS My Choice</td>
              <td>Verified address (DHL, UPS); email (DPD, GLS)</td>
            </tr>
            <tr>
              <td>Austria</td>
              <td>Post App with a Post Account</td>
              <td>Name and address must match the shop’s data</td>
            </tr>
            <tr>
              <td>Switzerland, Liechtenstein</td>
              <td>Swiss Post My consignments</td>
              <td>Verified address (code by letter)</td>
            </tr>
            <tr>
              <td>Netherlands</td>
              <td>PostNL account, My DHL, myDPD</td>
              <td>Address and first name (PostNL); email (DHL, DPD)</td>
            </tr>
            <tr>
              <td>Belgium</td>
              <td>My bpost app, DPD</td>
              <td>Email (bpost); postcode plus email or phone (DPD)</td>
            </tr>
            <tr>
              <td>France</td>
              <td>La Poste Mes suivis</td>
              <td>Your own La Poste purchases and partner shops</td>
            </tr>
            <tr>
              <td>Spain</td>
              <td>Correos app, miSEUR</td>
              <td>Shipments linked to you (Correos); email or mobile (SEUR)</td>
            </tr>
            <tr>
              <td>Italy</td>
              <td>Poste Italiane PostePlus</td>
              <td>Mobile number and email, for participating senders</td>
            </tr>
            <tr>
              <td>Portugal</td>
              <td>CTT app</td>
              <td>Purchases from shops that work with CTT</td>
            </tr>
            <tr>
              <td>Poland</td>
              <td>InPost Mobile, Mój DHL, Pocztex Mobile</td>
              <td>Phone number (plus extra emails for DHL)</td>
            </tr>
            <tr>
              <td>Czechia</td>
              <td>Pošta Online, Packeta app</td>
              <td>Phone or email on the shipment</td>
            </tr>
            <tr>
              <td>Sweden, Denmark, Norway, Finland</td>
              <td>PostNord app; Posten app (Norway); OmaPosti (Finland)</td>
              <td>Phone or email; strong e-ID plus phone (Posti)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>United Kingdom and Ireland</h2>
      <p>
        As far as we can tell, <strong>Royal Mail</strong> has no feature that
        lists parcels heading to your address. Its app tracks items by number
        and sends push alerts for the ones you add. For the rest of your UK
        deliveries, sign up with the couriers instead.
      </p>
      <ul>
        <li>
          <strong>DPD:</strong> the DPD app shows DPD and DPD Local parcels
          automatically, matched to your mobile number or email address{" "}
          <em>and</em> your delivery address (see{" "}
          <a href="https://www.dpd.co.uk/lp/app/index.html" rel="noopener noreferrer" target="_blank">DPD’s app page</a>
          ). A code sent to your phone or email confirms the profile. If you
          gave a shop a different number or email, the parcel won’t appear.
        </li>
        <li>
          <strong>Evri:</strong> a 2025 update to the Evri app said parcels
          associated with your account email would be added to your tracking
          list automatically. Evri’s help pages still tell recipients to get
          the tracking number from the sender, so treat it as a bonus rather
          than something to rely on. The app is listed on{" "}
          <a href="https://www.evri.com/our-services/mobile-app" rel="noopener noreferrer" target="_blank">Evri’s website</a>
          .
        </li>
        <li>
          <strong>UPS My Choice</strong> lists UPS parcels for your verified
          address, as it does in the US, though UPS says availability varies
          by location. Our{" "}
          <Link href="/guides/ups-my-choice">UPS My Choice guide</Link> covers
          the sign-up.
        </li>
        <li>
          <strong>FedEx:</strong> FedEx’s European pages describe Delivery
          Manager as something the shipper switches on for each parcel, after
          which FedEx emails or texts you a link (see{" "}
          <a href="https://www.fedex.com/en-gb/shipping-tools/deliverymanager.html" rel="noopener noreferrer" target="_blank">FedEx’s UK page</a>
          ). Unlike in the US, you generally can’t enrol your address
          yourself.
        </li>
      </ul>
      <p>
        In Ireland, <strong>An Post</strong> lists tracked parcels that match
        your email address or phone number in the My deliveries section of
        its website and app, including parcels you’re sending (see{" "}
        <a href="https://www.anpost.com/Post-Parcels/Receiving/My-deliveries" rel="noopener noreferrer" target="_blank">An Post’s My deliveries page</a>
        ). Sign up with the email and number you shop with, because a backup
        delivery option only works when the retailer passed those details on.
        If a driver leaves a parcel in your safe spot, An Post emails you, and
        you can see the photo for seven days while logged in.
      </p>

      <h2>Germany, Austria and Switzerland</h2>
      <p>
        This is the part of Europe where address-based programs are
        strongest.
      </p>
      <ul>
        <li>
          <strong>DHL (Germany):</strong> with a free DHL customer account,
          parcel announcement (Paketankündigung) sends you an email or app
          notification with the expected delivery day once a parcel reaches
          the parcel centre, including parcels other people send to the home
          address in your account (see{" "}
          <a href="https://www.dhl.de/en/privatkunden/pakete-empfangen/sendungen-verfolgen/paketankuendigung.html" rel="noopener noreferrer" target="_blank">DHL’s parcel announcement page</a>
          ). You confirm the address with a code DHL posts to you, which takes
          a few days, or with a POSTIDENT identity check. Parcels sent to a
          Packstation or branch, small parcels and returns aren’t announced.
        </li>
        <li>
          <strong>DPD:</strong> myDPD links parcels to the email address in
          your profile. The PIN that DPD posts to you is only needed to set a
          permanent safe place or change an address (see{" "}
          <a href="https://www.dpd.com/de/en/adressverifizierung-mydpd" rel="noopener noreferrer" target="_blank">DPD’s address verification page</a>
          ). DPD’s Predict email arrives a day or more ahead, followed by a
          one-hour delivery window on the day.
        </li>
        <li>
          <strong>GLS:</strong> the GLS app says it follows parcels
          automatically once you add your email addresses to your account,
          provided the shop gave GLS your email.
        </li>
        <li>
          <strong>Hermes:</strong> we found no Hermes feature that lists
          incoming parcels. Hermes emails a delivery announcement only when
          the shop shared your email address.
        </li>
        <li>
          <strong>UPS My Choice</strong> works in Germany too, with an
          activation code that arrives by letter a few days after you sign
          up.
        </li>
      </ul>
      <p>
        <strong>Austria:</strong> Austrian Post’s Post App and Post Account
        add new parcels automatically when the name and address the shop
        gave the sender match your Post Account (see{" "}
        <a href="https://www.post.at/p/c/postapp" rel="noopener noreferrer" target="_blank">Post’s app page</a>
        ). Parcels without electronic shipping data, which includes most
        parcels that private senders post at a branch, never appear, and
        Austrian users report that matching works often but not always.
        Registration is enough for the basic list; extra delivery options,
        such as a preferred drop-off spot, need an identity check, for
        example with ID Austria.
      </p>
      <p>
        <strong>Switzerland and Liechtenstein:</strong> Swiss Post’s My
        consignments is a true address program. You register with a SwissID,
        enter your home address and wait one to three days for a letter with
        a confirmation code. After that, parcels and registered letters
        addressed to you appear automatically, with a notice by email, push
        or optional SMS the day before and a delivery window on the day (see{" "}
        <a href="https://meine-sendungen.post.ch/en" rel="noopener noreferrer" target="_blank">Swiss Post’s My consignments</a>
        ). Only Swiss and Liechtenstein addresses qualify.
      </p>

      <h2>Netherlands and Belgium</h2>
      <p>
        <strong>PostNL</strong> links parcels on their way to you to your
        PostNL account when enough details match: the address must be the
        same and the first name must match, so a housemate’s parcel
        occasionally appears too (see{" "}
        <a href="https://www.postnl.nl/ontvangen/postnl-account/" rel="noopener noreferrer" target="_blank">PostNL’s account page</a>
        ). You confirm your address through iDIN, which uses your bank login,
        or with a letter containing a code that’s valid for 14 days.
        PostNL’s separate Mijn Post service sends a daily alert with photos of
        the letters on their way.
      </p>
      <p>
        <strong>DHL</strong> in the Netherlands has My DHL, which shows
        parcels sent to your account email; you can add other email addresses
        so parcels ordered with those appear as well (see{" "}
        <a href="https://www.dhlparcel.nl/en/my-dhl" rel="noopener noreferrer" target="_blank">My DHL</a>
        ). <strong>DPD</strong> links parcels to the email in your myDPD
        profile.
      </p>
      <p>
        In Belgium, the <strong>My bpost app</strong> adds bpost parcels
        linked to the email addresses saved in your profile, while parcels
        from other carriers have to be added by hand (see{" "}
        <a href="https://bpost.be/en/faq/which-parcels-can-i-follow-my-bpost-app-and-how-do-i-add-them" rel="noopener noreferrer" target="_blank">bpost’s FAQ</a>
        ). DPD Belgium only matches a parcel to you when your postcode matches
        as well as the email or phone number the sender has.
      </p>

      <h2>France, Spain, Italy and Portugal</h2>
      <p>
        Here the shop passing your contact details to the carrier matters
        most.
      </p>
      <ul>
        <li>
          <strong>France:</strong> La Poste’s “Mes suivis” list adds items
          you buy on laposte.fr or at a post office while logged in, and you
          can switch on automatic display of parcels from partner shops such
          as Fnac and Zalando in its settings (see{" "}
          <a href="https://aide.laposte.fr/categorie/mes-commandes-mon-espace-client/mon-espace-client/mes-suivis" rel="noopener noreferrer" target="_blank">La Poste’s help page</a>
          ). There’s no address-based list. Colissimo, Chronopost and DPD send
          their delivery emails to whatever address you gave the shop, and
          Mondial Relay and Vinted Go email you when a parcel reaches a pickup
          point.
        </li>
        <li>
          <strong>Spain:</strong> the Activity section of the Correos app is
          designed to show the shipments that belong to you automatically,
          including Vinted, Wallapop and AliExpress orders, without searching
          by code (see{" "}
          <a href="https://www.correos.es/es/es/herramientas/correos-app" rel="noopener noreferrer" target="_blank">the Correos app page</a>
          ). Correos doesn’t explain how it links them, so sign up with the
          email and phone number you shop with. SEUR’s miSEUR account gathers
          the orders associated with your email or mobile number.
        </li>
        <li>
          <strong>Italy:</strong> Poste Italiane’s PostePlus is a free
          dashboard of parcels addressed to you, matched by the mobile number
          and email you use for online shopping, but only from senders that
          have enabled it (see{" "}
          <a href="https://www.poste.it/posteplus" rel="noopener noreferrer" target="_blank">PostePlus</a>
          ). It also covers SDA, Poste’s courier. BRT’s myBRT app shows your
          shipments on one screen, but we couldn’t confirm that it adds them
          automatically.
        </li>
        <li>
          <strong>Portugal:</strong> the CTT app adds a parcel automatically
          when you buy from a shop that works with CTT; otherwise you add the
          tracking code yourself.
        </li>
      </ul>

      <h2>Poland, Czechia, the Baltics and Romania</h2>
      <p>
        Poland runs on phone numbers. <strong>InPost Mobile</strong> shows the
        parcels tied to your phone number, with the pickup code or QR code
        for the parcel locker. <strong>Mój DHL</strong> lists parcels assigned
        to your phone number and to any extra email addresses you verify,
        though the first number you register can’t be changed later (see{" "}
        <a href="https://www.dhl.com/pl-pl/ecommerce/dla-ciebie/obsluga/kontakt/centrum-pomocy-moj-dhl.html" rel="noopener noreferrer" target="_blank">the Mój DHL help centre</a>
        ). Poczta Polska’s <strong>Pocztex Mobile</strong> app shows
        shipments for the phone number you register.
      </p>
      <p>
        <strong>Shopping on Allegro?</strong> Carrier emails for Allegro
        orders usually don’t come from InPost, DPD or GLS directly. Allegro
        relays them from its own address,{" "}
        <code translate="no">powiadomienia@allegromail.pl</code>, with a
        sender name such as “InPost (via Poczta Allegro)”, and Allegro’s own
        shipping updates come from{" "}
        <code translate="no">powiadomienia@allegro.pl</code>. Sellers’
        messages use the same relay address, so expect to see them alongside
        the carrier notices. Parcels shipped with Allegro Delivery reportedly
        don’t appear in Mój DHL, which makes Allegro’s emails the best source
        for those.
      </p>
      <p>
        In Czechia, Česká pošta’s <strong>Pošta Online</strong> app loads a
        parcel by itself based on the phone number or email the sender
        entered (see{" "}
        <a href="https://www.ceskaposta.cz/en/uzitecne-nastroje/mobilni-aplikace-postaonline" rel="noopener noreferrer" target="_blank">Česká pošta’s app page</a>
        ), and the <strong>Packeta</strong> (Zásilkovna) app shows parcels
        for the phone number and email you verify. Shops can give Packeta
        just one of the two, so register both. In Estonia and Lithuania, DPD
        asks you to add a phone number and email to your profile so incoming
        parcels appear automatically, and Omniva lists incoming shipments in
        its self-service area after a Smart-ID, Mobile-ID or ID-card login.
        In Romania, the Sameday app shows deliveries for your phone number.
      </p>

      <h2>The Nordic countries</h2>
      <ul>
        <li>
          <strong>PostNord</strong> (Sweden, Denmark, Norway, Finland): add
          your phone number or email in the PostNord app and parcels are added
          automatically, as long as they match the details you gave at
          checkout (see{" "}
          <a href="https://www.postnord.se/en/our-tools/postnord-app/" rel="noopener noreferrer" target="_blank">PostNord’s app page</a>
          ). In Sweden you can collect parcels with Mobile BankID.
        </li>
        <li>
          <strong>Posti</strong> (Finland): OmaPosti asks for strong
          identification, such as a bank login or mobile certificate, when you
          create the account. After that, your phone number lets it show
          incoming deliveries automatically, along with the pickup code (see{" "}
          <a href="https://posti.fi/en/omaposti" rel="noopener noreferrer" target="_blank">OmaPosti</a>
          ).
        </li>
        <li>
          <strong>Posten and Bring</strong> (Norway): register in the Posten
          app with your phone number and email and it finds your parcels
          automatically; the phone number is activated with a code sent by
          text (see{" "}
          <a href="https://www.posten.no/en/tracking-help-page/tracking-app" rel="noopener noreferrer" target="_blank">Posten’s app page</a>
          ).
        </li>
      </ul>
      <p>
        All three lean heavily on app notifications. If you want emails as
        well, check each app’s notification settings, and keep the email
        address on file the same as the one you shop with.
      </p>

      <h2>Spotting fake parcel messages</h2>
      <p>
        Parcel scams are as common in Europe as anywhere, and they copy the
        local carrier’s name and logo. Posti and Swiss Post both warn that
        scammers fake the sender name and number, so a familiar sender isn’t
        proof on its own. If a message asks for a small payment, a customs
        fee or card details to release a parcel, don’t use its link: open the
        carrier’s app yourself and look the parcel up there. Once you’ve
        signed up as described above, a genuine parcel will often be listed
        there too. Our{" "}
        <Link href="/guides/fake-delivery-text-scams">guide to fake delivery texts</Link>{" "}
        walks through the warning signs.
      </p>

      <h2>Putting it all in one place</h2>
      <p>
        With a few apps switched on, the answer to “is anything coming?”
        is spread across several places. <span translate="no">Package Radar</span>{" "}
        collects the emails your carriers and shops send you: one email
        filter forwards them to your personal{" "}
        <span translate="no">Package Radar</span> address, and we turn them
        into one list. A few tips for Europe:
      </p>
      <ul>
        <li>
          Switch on email alerts in every carrier app. Push notifications and
          text messages can’t be forwarded, so we never see them.
        </li>
        <li>
          Use one email address for shopping and for every carrier account,
          and forward from that mailbox.
        </li>
        <li>
          Forward shop emails as well, such as Amazon’s or Allegro’s shipping
          updates; they cover carriers you haven’t signed up with.
        </li>
        <li>
          Emails in German, French, Polish or any other language are fine to
          forward, although for some carriers we can only pick out the
          tracking number and a basic status.
        </li>
      </ul>
      <p>
        From each email we keep only the carrier, the tracking or order
        number, the sender, the status and the dates. We don’t store what you
        ordered, because item names can reveal more than you’d want. When
        you’re ready, the <Link href="/setup">setup</Link> shows which
        services cover your country. For the background on how carrier
        programs work, see our guide to{" "}
        <Link href="/guides/how-to-see-every-package-coming-to-your-address">seeing every package coming to your address</Link>
        , and if a parcel has already gone quiet, our guide to{" "}
        <Link href="/guides/track-a-package-without-a-tracking-number">tracking without a tracking number</Link>{" "}
        lists what still works.
      </p>
    </>
  );
}
