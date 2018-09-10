import "isomorphic-fetch";
import { Dialog } from "./dialog";
import { Segment, HKSPA, HISPA, HKKAZ, HIKAZ } from "./segments";
import { Request } from "./request";
import { Response } from "./response";
import { SEPAAccount, Statement } from "./types";
import { read } from "mt940-js";
import { is86Structured, parse86Structured } from "./mt940-86-structured";

/**
 * An abstract class for communicating with a fints server.
 * For a common implementation look at `PinTanClient`.
 */
export abstract class Client {
    /**
     * Create a new dialog.
     */
    protected abstract createDialog(): Dialog;
    /**
     * Create a request.
     */
    protected abstract createRequest(dialog: Dialog, segments: Segment<any>[], tan?: string): Request;

    /**
     * Fetch a list of all SEPA accounts accessible by the user.
     *
     * @return An array of all SEPA accounts.
     */
    public async accounts(): Promise<SEPAAccount[]> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();
        const response = await dialog.send(this.createRequest(dialog, [
            new HKSPA({ segNo: 3 }),
        ]));
        await dialog.end();
        const hispa = response.findSegment(HISPA);
        return hispa.accounts;
    }

    /**
     * Fetch a list of bank statements deserialized from the MT940 transmitted by the fints server.
     *
     * @param startDate The start of the range for which the statements should be fetched.
     * @param endDate The end of the range for which the statements should be fetched.
     *
     * @return A list of all statements in the specified range.
     */
    public async statements(account: SEPAAccount, startDate: Date, endDate: Date): Promise<Statement[]> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();
        let touchdowns: Map<string, string>;
        let touchdown: string;
        const responses: Response[] = [];
        do {
            const request = this.createRequest(dialog, [
                new HKKAZ({
                    segNo: 3,
                    version: dialog.hikazsVersion,
                    account,
                    startDate,
                    endDate,
                    touchdown,
                }),
            ]);
            const response = await dialog.send(request);
            touchdowns = response.getTouchdowns(request);
            touchdown = touchdowns.get("HKKAZ");
            responses.push(response);
        } while (touchdown);
        await dialog.end();
        const segments: HIKAZ[] = responses.reduce((result, response: Response) => {
            result.push(...response.findSegments(HIKAZ));
            return result;
        }, []);
        const bookedString = segments.map(segment => segment.bookedTransactions || "").join("");
        const unprocessedStatements = await read(Buffer.from(bookedString, "utf8"));
        return unprocessedStatements.map(statement => {
            const transactions = statement.transactions.map(transaction => {
                if (!is86Structured(transaction.description)) { return transaction; }
                const descriptionStructured = parse86Structured(transaction.description);
                return { ...transaction, descriptionStructured };
            });
            return { ...statement, transactions };
        });
    }
}