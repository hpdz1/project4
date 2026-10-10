import { it } from "vitest";
import type { CarrierId } from "@/lib/types";
import { findTrackingNumbers } from "./extract";
import { detectTrackingNumber } from "./formats";

const P = (t: string, h?: CarrierId) => process.stderr.write(`${JSON.stringify(t)}${h ? ` [${h}]` : ""} -> ${JSON.stringify(findTrackingNumbers(t, h ? { carrierHint: h } : {}).map((r) => `${r.carrier}:${r.trackingNumber}${r.originCountry ? "@" + r.originCountry : ""}`))}\n`);
const D = (n: string, h?: CarrierId) => process.stderr.write(`detect ${n}${h ? ` [${h}]` : ""} -> ${JSON.stringify(detectTrackingNumber(n, h ? { carrierHint: h } : {}))}\n`);
it("probe", () => {
  for (const t of [
    "Ihre Sendungsnummer: 3318810025", "Numéro de suivi : 3318810025", "Número de seguimiento: 3318810025",
    "Codice di spedizione 3318810025", "Track & Trace code 3318810025", "Numer przesyłki: 3318810025", "追跡番号：3318810025",
    "运单号：3318810025", "송장번호: 3318810025", "Takip no: 3318810025", "Kollinummer 3318810025", "Código de rastreio 3318810025",
    "Трек-номер 3318810025", "رقم التتبع 3318810025", "Zendingnummer 3318810025", "Lähetystunnus 3318810025", "Ihre Nummer 3318810025",
    "DHL Paket: Ihre Sendung 201298452277 ist unterwegs", "ヤマト運輸 お問い合わせ番号：4909-1361-1252", "日本郵便 ゆうパック お問い合わせ番号 1525-1591-7783",
    "佐川急便 お問い合わせ送り状No. 3657-2936-5455", "GLS Paketnummer 841225178292", "Canada Post tracking number 2010 5057 9943 6494",
    "Purolator PIN 520769802262", "Hermes Sendungsnummer 02180171003654", "Blue Dart AWB 36206727712", "Aramex shipment 9680012996",
    "PostNord kolli-ID 00573132901903503247", "Bring sendingsnummer 370722152621578495", "InPost numer przesyłki 620999677033395439338699",
    "DPD Paketnummer 15504366056765", "Delhivery tracking 28449706147373", "SF Express 运单号 133938675660", "顺丰 运单号 133938675660", "Estafeta número de guía 1172614482",
    "Tracking number: 841225178292", "Tracking number: 2010505799436494", "Tracking number: 201298452277", "Tracking number: 490913611252",
    "Bitte 201298452277 angeben", "Your code 490913611252", "Sendungsnummer 111111111111", "Tracking: 00000000000000000000",
    "Your parcel LZ449705219CN from China", "Swiss Post 99.60.132730.02019507 Sendung",
    "00340434633751428115 JJD000030247489000000075290 H00RVD0551541466 3SABCD1175003 9V00001481952 SF6047789135544 LP00492448725445 YT2625900708886066 4PX3002555003946CN 24622447660SE CG738165082DE",
  ]) P(t);
  P("Package 15504366056765 arriving", "dpd");
  P("Sendung 15504366056765 kommt", "dpd");
  for (const n of ["490913611252", "201298452277", "841225178292", "2010505799436494", "RA00032528599", "5P65D73186819", "NP989065909JB", "XY123456789NZ", "00340434633751428116", "JJD0002257639032011", "111111111111", "TBM123456789012"]) D(n);
  D("JJD0002257639032011", "inpost");
});
