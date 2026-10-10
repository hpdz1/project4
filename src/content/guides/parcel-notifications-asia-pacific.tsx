import Link from "next/link";
import type { GuideMeta } from "./types";

export const meta: GuideMeta = {
  slug: "parcel-notifications-asia-pacific",
  title: "How to get notified about parcels coming to you in Asia-Pacific",
  description:
    "Which carriers in Japan, Korea, China, India, Australia, New Zealand and Southeast Asia tell you about incoming parcels, and what to expect from Temu orders.",
  published: "2026-10-10",
  updated: "2026-10-10",
  readingMinutes: 9,
  category: "Around the world",
};

export default function Content() {
  return (
    <>
      <p>
        Across Asia and the Pacific, how you hear about an incoming parcel
        depends heavily on where you live. Japan, Australia and New Zealand
        have carrier programs that email you about parcels on their way. In
        much of the rest of the region, carriers match parcels to your mobile
        number and tell you through an app, a text message or a messaging
        service such as LINE, KakaoTalk, WeChat, WhatsApp or Zalo. And
        nowhere will a carrier show you every parcel heading to an address
        just because you typed it in. This guide covers what you can switch
        on in each country, and what to expect from the cross-border shops
        that send so many of the region’s parcels.
      </p>

      <h2>The region at a glance</h2>
      <p>
        The last column matters if you want all your alerts in one place:
        only email can be forwarded automatically.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Country</th>
              <th scope="col">What to switch on</th>
              <th scope="col">How you’re matched</th>
              <th scope="col">Carrier emails?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Japan</td>
              <td>Japan Post e-Delivery Notification; Yamato Kuroneko Members</td>
              <td>Your registered name, address and phone</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>South Korea</td>
              <td>CJ Logistics O-NE app</td>
              <td>Mobile number on the label</td>
              <td>No: app and KakaoTalk</td>
            </tr>
            <tr>
              <td>Mainland China</td>
              <td>Cainiao app; SF Express</td>
              <td>Mobile number and linked shopping accounts</td>
              <td>No: app, SMS and WeChat</td>
            </tr>
            <tr>
              <td>Hong Kong</td>
              <td>Give senders your mobile number</td>
              <td>Mobile number on the item</td>
              <td>No: SMS</td>
            </tr>
            <tr>
              <td>Singapore</td>
              <td>SingPost app</td>
              <td>Tracking number</td>
              <td>No: app notifications</td>
            </tr>
            <tr>
              <td>India</td>
              <td>Shop order pages; Delhivery mobile lookup</td>
              <td>Mobile number</td>
              <td>Rarely</td>
            </tr>
            <tr>
              <td>Southeast Asia</td>
              <td>Shop and carrier apps</td>
              <td>Tracking number</td>
              <td>Rarely: WhatsApp, LINE, Zalo or SMS</td>
            </tr>
            <tr>
              <td>Australia</td>
              <td>Australia Post MyPost; Aramex Receiving mode</td>
              <td>The email and mobile number you shop with</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>New Zealand</td>
              <td>NZ Post app with a My NZ Post account; Aramex</td>
              <td>Your account details; email for Aramex</td>
              <td>Sometimes</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Japan</h2>
      <p>
        Japan is the one country in Asia where all the big carriers run free,
        account-based email programs much like the US ones.
      </p>
      <ul>
        <li>
          <strong>Japan Post e-Delivery Notification</strong> (
          <span lang="ja">eお届け通知</span>): register a Yu ID, press
          Activate in the e-Delivery Notification section and confirm the
          email address. Japan Post’s{" "}
          <a href="https://faq-jpid.pf.japanpost.jp/hc/en-us/articles/9774452289935-Q-Please-tell-me-about-the-e-Delivery-Notification-service-and-how-to-set-it-up" rel="noopener noreferrer" target="_blank">English FAQ</a>{" "}
          has the steps, and notices can go to up to two email addresses. It
          emails you when a Yu-Pack parcel is on its way to you and when one
          is taken back after a missed delivery, and lets you change the
          delivery time or place. It relies on the sender’s electronic
          shipping data and your registered name and address, so not every
          item will appear. A LINE version works without a Yu ID when the
          phone number on the label matches your LINE account.
        </li>
        <li>
          <strong>Yamato Transport Kuroneko Members</strong> (
          <span lang="ja">クロネコメンバーズ</span>): the free membership
          sends a delivery-schedule email (
          <span lang="ja">お届け予定eメール</span>) before a parcel arrives,
          and Yamato has long offered missed-delivery and delivered emails as
          well. You register your name, address and phone number, and the
          phone number is checked by text or voice call. As with Japan Post,
          the schedule email only covers parcels whose sender data supports
          it.
        </li>
        <li>
          <strong>Sagawa Express Smart Club</strong> (
          <span lang="ja">スマートクラブ</span>) sends delivery-schedule
          emails to members. In autumn 2026 Sagawa suspended parts of its web
          services after a reported security incident, so check Sagawa’s own
          notices before you sign up or rely on it.
        </li>
      </ul>
      <p>
        Two tips. The LINE versions give less detail than the emails
        (Yamato’s LINE message, for example, shows only the last four digits
        of the slip number), so choose email if you want the full picture.
        And all three carriers say they don’t send missed-delivery notices by
        text message, with Japan Post making an exception only for its
        merchandise subsidiary. A text claiming to be a missed delivery from
        one of them is almost certainly a scam. Amazon.co.jp emails cover
        your own orders, whichever carrier delivers them.
      </p>

      <h2>South Korea and mainland China</h2>
      <p>
        Korean and Chinese carriers match parcels to your mobile number, and
        they notify you in apps and messaging services rather than by email.
      </p>
      <ul>
        <li>
          <strong>South Korea:</strong> after you verify your identity with
          your phone, CJ Logistics’ O-NE app lists the CJ parcels from the
          last 90 days where the recipient number is yours, with no waybill
          needed. A parcel won’t appear if the sender typed a different
          number, and new ones can take a few hours to show up. Korea Post
          lets members look up parcels by phone number after an identity
          check, but you have to ask each time. Most shops and carriers send
          updates as KakaoTalk business messages (
          <span lang="ko">알림톡</span>).
        </li>
        <li>
          <strong>Mainland China:</strong> the Cainiao app lists parcels
          automatically once you bind your phone number and link shopping
          accounts such as Taobao or Tmall, and SF Express shows recent
          waybills for the number you log in with. EMS lets you look up about
          a week of items by phone number through its WeChat account. These
          tools are built around a mainland mobile number, and “privacy
          waybills” that hide your real number can stop the matching.
        </li>
      </ul>
      <p>
        None of these can be forwarded by email. If you live in Korea or
        China, the useful emails are the ones shops send you directly.
      </p>

      <h2>Orders from AliExpress, Temu, Shein and other cross-border shops</h2>
      <p>
        Cross-border marketplaces ship enormous numbers of small parcels from
        China to every country in the region and beyond. Their tracking works
        differently from a domestic parcel, which explains most of the
        confusion around it.
      </p>
      <ol>
        <li>
          <strong>A logistics company handles the first leg.</strong> The
          number in your order often comes from a cross-border shipper such as
          Cainiao, YunExpress, 4PX or Yanwen. Cainiao references often start
          with <code translate="no">LP</code>, YunExpress numbers with{" "}
          <code translate="no">YT</code> and 4PX numbers with{" "}
          <code translate="no">4PX</code>. Some of these references only work
          on the shipper’s own tracking page. None of these companies has a
          program that lists parcels by your address or email.
        </li>
        <li>
          <strong>Your postal service or a local courier does the last
          leg.</strong> After the parcel clears customs, it’s handed to your
          national post or a local courier. Sometimes the number stays the
          same; sometimes the local carrier uses its own. Postal items
          commonly carry a 13-character international number: two letters,
          nine digits and a two-letter code, usually the country of the postal
          service that issued it, such as <code translate="no">CN</code>.
        </li>
        <li>
          <strong>Expect quiet stretches.</strong> Long gaps between updates,
          “arrived in destination country” and customs entries are normal. A
          parcel can sit for days between the airport and the local carrier’s
          first scan.
        </li>
      </ol>
      <p>
        So what works? Make the shop’s order page your main source, because it
        usually updates at the hand-off and often shows the local carrier’s
        number. Forward or keep the shop’s shipping emails, which sometimes
        name the local carrier that has taken over. Once a local carrier has
        the parcel, an account-based program such as Australia Post’s MyPost
        may pick it up if the label carries the email or mobile number you
        registered. If tracking stops completely for several weeks, contact
        the shop rather than the carrier: the shop is the carrier’s customer
        and is the one that can open an investigation.
      </p>

      <h2>Hong Kong, Taiwan and Singapore</h2>
      <ul>
        <li>
          <strong>Hong Kong:</strong> Hongkong Post has no account that lists
          incoming items. Instead, it asks senders to include the addressee’s
          mobile number so you get a text before delivery. Hongkong Post says
          its genuine texts begin with the registered sender name{" "}
          <code translate="no">#HKPost</code> and that it never sends you
          phone numbers to call by SMS or email.
        </li>
        <li>
          <strong>Taiwan:</strong> T-Cat (
          <span lang="zh-Hant">黑貓宅急便</span>) sends “parcel expected
          today” messages to members through its official LINE account, and
          Chunghwa Post has an app with personalised notifications. We didn’t
          find email alerts from either.
        </li>
        <li>
          <strong>Singapore:</strong> SingPost replaced its SMS alerts with
          notifications in the SingPost app in 2022, and says not to trust
          emails from domains other than singpost.com (see{" "}
          <a href="https://www.singpost.com/mobileapp" rel="noopener noreferrer" target="_blank">SingPost’s app page</a>
          ). The app tracks items by number; we didn’t find a feature that
          adds incoming items automatically. Ninja Van, which delivers for
          many online shops in Singapore and its neighbours, sends updates
          when the shop provides your details, and says its official emails
          come from addresses ending in <code translate="no">ninjavan.co</code>.
        </li>
      </ul>

      <h2>India and Southeast Asia</h2>
      <p>
        We found no carrier in India or Southeast Asia with a program that
        emails you about every parcel coming to you. Here’s what does exist.
      </p>
      <ul>
        <li>
          <strong>India Post</strong> texts the addressee when an item
          arrives, if the sender recorded your mobile number at booking. Its
          app tracks by article number only.
        </li>
        <li>
          <strong>Delhivery</strong> also lets you look up shipments by
          mobile number, confirmed with a one-time code, instead of a waybill.
          Blue Dart says it never asks for a PIN or one-time code for payment,
          which helps you spot fake “pay to release your parcel” messages.
        </li>
        <li>
          <strong>Flipkart</strong> orders, mostly delivered by Ekart, are
          tracked under My Orders, and Flipkart emails and texts you when the
          seller ships. Amazon.in emails cover your own orders.
        </li>
        <li>
          <strong>Malaysia, Indonesia, the Philippines, Thailand and
          Vietnam:</strong> carriers such as Pos Malaysia, J&amp;T, JNE,
          SiCepat, PHLPost, Thailand Post, Kerry (now KEX), Flash and GHTK
          mostly track by waybill number. Updates come from the shop or the
          carrier through WhatsApp, LINE, Zalo or SMS. Some, J&amp;T among
          them, use the last four digits of your phone number only to confirm
          a lookup.
        </li>
      </ul>
      <p>
        If you live here, the most useful things to collect are the shop
        shipping emails that contain a tracking number. Messages that arrive
        only inside an app or a chat service stay out of reach of any email
        tool.
      </p>

      <h2>Australia and New Zealand</h2>
      <ul>
        <li>
          <strong>Australia Post MyPost:</strong> a free MyPost account adds
          parcels automatically when Australia Post has the information it
          needs. Register your mobile number, your address and every email
          address you shop with, because matching relies on the email and
          mobile number the sender supplies (see{" "}
          <a href="https://auspost.com.au/receiving/mypost" rel="noopener noreferrer" target="_blank">MyPost</a>
          ). A verified mobile number unlocks text alerts and Parcel Lockers.
          Choose email as a notification channel if you want to forward the
          alerts.
        </li>
        <li>
          <strong>Aramex (formerly Fastway):</strong> aramexConnect’s free
          Receiving mode lists your incoming Aramex parcels in a browser, with
          photo proof of delivery. You must sign up with the same email
          address the sender put on the label (see{" "}
          <a href="https://www.aramex.com.au/tools/aramexconnect/receiving-mode/" rel="noopener noreferrer" target="_blank">Aramex’s Receiving mode page</a>
          ). Aramex offers the same mode in New Zealand.
        </li>
        <li>
          <strong>Sendle and CouriersPlease</strong> have no recipient
          accounts. Sendle emails you at pickup, about delays and on delivery
          when the sender gives it your email (see{" "}
          <a href="https://support.sendle.com/hc/en-au/articles/360002392371-Receiver-information" rel="noopener noreferrer" target="_blank">Sendle’s receiver page</a>
          ), and CouriersPlease sends delivery choices through a secure link
          when the sender supplied your email and mobile number.
        </li>
        <li>
          <strong>NZ Post:</strong> sign in to the NZ Post app with a My NZ
          Post account and it links parcels to your account automatically;
          eligible parcels even show the sender’s name (see{" "}
          <a href="https://nzpost.co.nz/personal/app" rel="noopener noreferrer" target="_blank">NZ Post’s app page</a>
          ). NZ Post doesn’t say exactly which details it matches, and email
          updates arrive only if the sender gave NZ Post your email. NZ Post
          says its genuine emails always end in{" "}
          <code translate="no">@nzpost.co.nz</code>.
        </li>
      </ul>

      <h2>Putting it all in one place</h2>
      <p>
        <span translate="no">Package Radar</span> works from email: you add
        one filter that forwards your carriers’ and shops’ notices to a
        personal <span translate="no">Package Radar</span> address, and we
        turn them into a single list of what’s on the way. How much that
        covers depends on your country:
      </p>
      <ul>
        <li>
          <strong>Japan, Australia and New Zealand:</strong> turn on email
          notices with each carrier above and forward them. Our support for
          Japanese-language carrier emails is basic for now, so expect
          tracking numbers and simple statuses rather than full detail.
        </li>
        <li>
          <strong>Everywhere else:</strong> forward the shipping emails from
          the shops you buy from. They’re often the only email you’ll get
          about a parcel.
        </li>
        <li>
          <strong>Not reachable:</strong> app notifications, text messages
          and messages in LINE, KakaoTalk, WeChat, WhatsApp or Zalo can’t be
          forwarded by email, so we never see them.
        </li>
      </ul>
      <p>
        From each email we keep only the carrier, the tracking or order
        number, the sender, the status and the dates. We don’t store what you
        ordered, because item names can reveal more than you’d want. The{" "}
        <Link href="/setup">setup</Link> shows which services cover your
        country. For the background on carrier programs, read our guide to{" "}
        <Link href="/guides/how-to-see-every-package-coming-to-your-address">seeing every package coming to your address</Link>
        ; if a parcel has gone quiet, see{" "}
        <Link href="/guides/track-a-package-without-a-tracking-number">what still works without a tracking number</Link>
        ; and if a text about a parcel looks wrong, our{" "}
        <Link href="/guides/fake-delivery-text-scams">guide to fake delivery texts</Link>{" "}
        shows the warning signs.
      </p>
    </>
  );
}
