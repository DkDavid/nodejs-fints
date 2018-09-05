import { SegmentClass } from "./segment";

export class HKWPDProps {
    public segNo: number;
    public version: number;
    public account: string;
}
/**
 * HKWPD (Depotaufstellung anfordern)
 * Example: HKWPD:3:7+23456::280:10020030+USD+2'
 * Section C.4.3.1
 */
export class HKWPD extends SegmentClass(HKWPDProps) {
    public type = "HKWPD";

    protected serialize() {
        return [ this.account ];
    }

    protected deserialize() { throw new Error("Not implemented."); }
}
