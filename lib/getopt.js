/** @babel */
import * as char from 'hjs-core/lib/char';
import {Command} from 'hjs-cmd/lib/command';

export const NO_ARGUMENT = 0;
export const REQUIRED_ARGUMENT = 1;
export const OPTIONAL_ARGUMENT = 2;

export class LongOpt {

    constructor({name, has_arg = NO_ARGUMENT, flag = [], val = 0} = {}) {
        if ((has_arg !== NO_ARGUMENT) && (has_arg !== REQUIRED_ARGUMENT)
            && (has_arg !== OPTIONAL_ARGUMENT)) {
            throw new ReferenceError(`Invalid flag ${flag}`);
        }
        this.name = name;
        this.has_arg = has_arg;
        this.flag = flag;
        this.val = val;
    }

    getFlag() {
        return this.flag;
    }

    getHasArg() {
        return this.has_arg;
    }

    getName() {
        return this.name;
    }

    getVal() {
        return this.val;
    }

}

export const REQUIRE_ORDER = 1;
export const PERMUTE = 2;
export const RETURN_IN_ORDER = 3;

export class Getopt extends Command {

    constructor({
        program,
        argv,
        optstring = '',
        long_options = null,
        long_only = false,
        posixly_correct = false,
        interactive = false,
        internalExecute = null
    } = {}) {
        super({name: program});
        if (optstring.length === 0) {
            optstring = " ";
        }
        this.params['interactive'] = interactive;
        this.params['optarg'] = null;
        this.params['nextchar'] = null;
        this.params['optstring'] = optstring;
        this.params['optind'] = 0;
        this.params['longind'] = 0;
        this.params['last_nonopt'] = 1;
        this.params['first_nonopt'] = 1;
        this.params['opterr'] = true;
        this.params['endparse'] = false;
        this.params['longopt_handled'] = false;
        this.params['optopt'] = char.QUESTION_MARK;
        this.params['argv'] = argv;
        this.params['long_options'] = long_options;
        this.params['long_only'] = long_only;
        this.params['posixly_correct'] = posixly_correct;
        if (optstring.charAt(0) === '-') {
            this.params['ordering'] = RETURN_IN_ORDER;
            if (optstring.length > 1) {
                this.params['optstring'] = optstring.substring(1);
            }
        } else if (optstring.charAt(0) === '+') {
            this.params['ordering'] = REQUIRE_ORDER;
            if (optstring.length > 1) {
                this.params['optstring'] = optstring.substring(1);
            }
        } else if (posixly_correct) {
            this.params['ordering'] = REQUIRE_ORDER;
        } else {
            this.params['ordering'] = PERMUTE;
        }
        if (internalExecute !== null) {
            this.internalExecute = internalExecute;
        }
    }

    checkLongOption() {
        let pfound;
        let nameend = this.params['nextchar'].indexOf("=");
        let ambig = false;
        let exact = false;
        this.params['longopt_handled'] = true;
        this.params['longind'] = -1;
        if (nameend == -1) {
            nameend = this.params['nextchar'].length;
        }
        let i = 0;
        // Test all lnog options for either exact match or abbreviated matches
        for (const options of this.params['long_options']) {
            if (char.startsWith(options.getName(), this.params['nextchar'].substring(0, nameend))) {
                if (options === this.params['nextchar'].substring(0, nameend)) {
                    // Exact match found
                    pfound = options;
                    this.params['longind'] = i;
                    exact = true;
                    break;
                } else if (pfound === null) {
                    // First nonexact match found
                    pfound = options;
                    this.params['longind'] = i;
                } else {
                    // Second or later nonexact match found
                    ambig = true;
                }
            }
            i++;
        }
        // Print out an error if the option specified was ambiguous
        if (ambig && !exact) {
            if (this.params['opterr']) {
                console.warn(this.name + ` option ${this.params['argv'][this.params['optind']]} is ambiguous`);
            }
            this.params['nextchar'] = "";
            this.params['optopt'] = 0;
            ++this.params['optind'];
            return char.QUESTION_MARK;
        }
        if (pfound !== null) {
            ++this.params['optind'];
            if (nameend !== this.params['nextchar'].length) {
                if (pfound.has_arg !== NO_ARGUMENT) {
                    if (this.params['nextchar'].substring(nameend, this.params['nextchar'].length).length > 1) {
                        this.params['optarg'] = this.params['nextchar'].substring(nameend + 1, this.params['nextchar'].length);
                    } else {
                        this.params['optarg'] = "";
                    }
                } else {
                    if (this.params['opterr']) {
                        if (char.startsWith(this.params['argv'][this.params['optind'] - 1], "--")) {
                            // -- option
                            console.warn(this.name +
                                ` option --${pfound.name} doesn't allow an argument`);
                        } else {
                            // +option or -option
                            console.warn(this.name +
                                ` option ${this.params['argv'][this.params['optind'] - 1].charAt(0)}${pfound.name} doesn't allow an argument`);
                        }
                    }
                    this.params['nextchar'] = "";
                    this.params['optopt'] = pfound.val;
                    return char.QUESTION_MARK;
                }
            } else if (pfound.has_arg === REQUIRED_ARGUMENT) {
                if (this.params['optind'] < this.params['argv'].length) {
                    this.params['optarg'] = this.params['argv'][this.params['optind']];
                    ++this.params['optind'];
                } else {
                    if (this.params['opterr']) {
                        console.warn(this.name +
                            ` option ${this.params['argv'][this.params['optind'] - 1]} requires an argument`);
                    }
                    this.params['nextchar'] = "";
                    this.params['optopt'] = pfound.val;
                    return this.params['optstring'].charAt(0) === ':' ? char.COLON : char.QUESTION_MARK;
                }
            }
            this.params['nextchar'] = "";
            if (pfound.flag !== null) {
                pfound.flag = [];
                pfound.flag.push(pfound.val);
                return 0;
            }
            return pfound.val;
        }
        this.params['longopt_handled'] = false;
        return 0;
    }

    exchange(argv) {
        let bottom = this.params['first_nonopt'];
        let middle = this.params['last_nonopt'];
        let top = this.params['optind'];
        let tem;
        while (top > middle && middle > bottom) {
            if (top - middle > middle - bottom) {
                // Bottom segment is the short one.
                let len = middle - bottom;
                // Swap it with the top part of the top segment.
                for (let i = 0; i < len; i++) {
                    tem = argv[bottom + i];
                    argv[bottom + i] = argv[top - (middle - bottom) + i];
                    argv[top - (middle - bottom) + i] = tem;
                }
                // Exclude the moved bottom segment from further swapping.
                top -= len;
            } else {
                // Top segment is the short one.
                let len = top - middle;
                // Swap it with the bottom part of the bottom segment.
                for (let i = 0; i < len; i++) {
                    tem = argv[bottom + i];
                    argv[bottom + i] = argv[middle + i];
                    argv[middle + i] = tem;
                }
                // Exclude the moved top segment from further swapping.
                bottom += len;
            }
        }
        // Update records for the slots the non-options now occupy.
        this.params['first_nonopt'] += (this.params['optind'] - this.params['last_nonopt']);
        this.params['last_nonopt'] = this.params['optind'];
    }

    execute(...options) {
        try {
            let c;
            let interactive = this.params['interactive'];
            if (!interactive) {
                while ((c = this.getopt()) !== -1) {
                    this.internalExecute(String.fromCharCode(c));
                }
            } else {
                c = this.getopt();
                if (c !== -1) {
                    this.internalExecute(String.fromCharCode(c), ...options);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    getLongind() {
        return this.params['longind'];
    }

    getopt() {
        this.params['optarg'] = null;
        if (this.params['endparse']) {
            return -1;
        }
        if ((this.params['nextchar'] === null) || (this.params['nextchar'] === "")) {
            // If we have just processed some options following some non-options,
            //  exchange them so that the options come first.
            if (this.params['last_nonopt'] > this.params['optind']) {
                this.params['last_nonopt'] = this.params['optind'];
            }
            if (this.params['first_nonopt'] > this.params['optind']) {
                this.params['first_nonopt'] = this.params['optind'];
            }
            if (this.params['ordering'] === PERMUTE) {
                // If we have just processed some options following some non-options,
                // exchange them so that the options come first.
                if ((this.params['first_nonopt'] !== this.params['last_nonopt']) && (this.params['last_nonopt'] !== this.params['optind'])) {
                    this.exchange(this.params['argv']);
                } else if (this.params['last_nonopt'] !== this.params['optind']) {
                    this.params['first_nonopt'] = this.params['optind'];
                }
                // Skip any additional non-options
                // and extend the range of non-options previously skipped.
                while ((this.params['optind'] < this.params['argv'].length) &&
                (this.params['argv'][this.params['optind']] === "") ||
                (this.params['argv'][this.params['optind']] &&
                this.params['argv'][this.params['optind']].charAt(0) !== '-') ||
                (this.params['argv'][this.params['optind']] === "-")) {
                    this.params['optind']++;
                }
                this.params['last_nonopt'] = this.params['optind'];
            }
            // The special ARGV-element `--' means premature end of options.
            // Skip it like a null option,
            // then exchange with previous non-options as if it were an option,
            // then skip everything else like a non-option.
            if ((this.params['optind'] !== this.params['argv'].length) && this.params['argv'][this.params['optind']] === "--") {
                this.params['optind']++;
                if ((this.params['first_nonopt'] !== this.params['last_nonopt']) &&
                    (this.params['last_nonopt'] !== this.params['optind'])) {
                    this.exchange(this.params['argv']);
                } else if (this.params['first_nonopt'] === this.params['last_nonopt']) {
                    this.params['first_nonopt'] = this.params['optind'];
                }
                this.params['last_nonopt'] = this.params['argv'].length;
                this.params['optind'] = this.params['argv'].length;
            }
            // If we have done all the ARGV-elements, stop the scan
            // and back over any non-options that we skipped and permuted.
            if (this.params['optind'] === this.params['argv'].length) {
                // Set the next-arg-index to point at the non-options
                // that we previously skipped, so the caller will digest them.
                if (this.params['first_nonopt'] !== this.params['last_nonopt']) {
                    this.params['optind'] = this.params['first_nonopt'];
                }
                return -1;
            }
            // If we have come to a non-option and did not permute it,
            // either stop the scan or describe it to the caller and pass it by.
            if (this.params['argv'][this.params['optind']] === "" ||
                (this.params['argv'][this.params['optind']].charAt(0) !== '-') ||
                this.params['argv'][this.params['optind']] === "-") {
                if (this.params['ordering'] === REQUIRE_ORDER) {
                    return -1;
                }
                this.params['optarg'] = this.params['argv'][this.params['optind']++];
                return 1;
            }
            // We have found another option-ARGV-element.
            // Skip the initial punctuation.
            if (char.startsWith(this.params['argv'][this.params['optind']], "--")) {
                this.params['nextchar'] = this.params['argv'][this.params['optind']].substring(2);
            } else {
                this.params['nextchar'] = this.params['argv'][this.params['optind']].substring(1);
            }
        }
        // Decode the current option-ARGV-element.
        /* Check whether the ARGV-element is a long option.
         If long_only and the ARGV-element has the form "-f", where f is
         a valid short option, don't consider it an abbreviated form of
         a long option that starts with f.  Otherwise there would be no
         way to give the -f short option.
         On the other hand, if there's a long option "fubar" and
         the ARGV-element is "-fu", do consider that an abbreviation of
         the long option, just like "--fu", and not "-f" with arg "u".
         This distinction seems to be the most useful approach.  */
        if ((this.params['long_options'] !== null) &&
            (char.startsWith(this.params['argv'][this.params['optind']], "--") || (this.params['long_only'] && ((this.params['argv'][optind].length > 2) ||
            (this.params['optstring'].indexOf(this.params['argv'][this.params['optind']].charAt(1)) === -1))))) {
            let c = this.checkLongOption();
            if (this.params['longopt_handled']) {
                return c;
            }
            // Can't find it as a long option.  If this is not getopt_long_only,
            // or the option starts with '--' or is not a valid short
            // option, then it's an error.
            // Otherwise interpret it as a short option.
            if (!this.params['long_only'] || char.startsWith(this.params['argv'][this.params['optind']], "--") ||
                (this.params['optstring'].indexOf(this.params['nextchar'].charAt(0)) === -1)) {
                if (this.params['opterr']) {
                    if (char.startsWith(this.params['argv'][this.params['optind']], "--")) {
                        console.warn(this.name +
                            ` unrecognized option --${this.params['nextchar']}`);
                    } else {
                        console.warn(this.name +
                            ` unrecognized option ${this.params['argv'][this.params['optind']].charAt(0)}${this.params['nextchar']}`);
                    }
                }
                this.params['nextchar'] = "";
                ++this.params['optind'];
                this.params['optopt'] = 0;
                return char.QUESTION_MARK;
            }
        }
        // Look at and handle the next short option-character */
        let c = this.params['nextchar'].charAt(0);
        this.params['nextchar'] = this.params['nextchar'].length > 1 ? this.params['nextchar'].substring(1, this.params['nextchar'].length) : "";
        let temp = null;
        if (this.params['optstring'].indexOf(c) !== -1) {
            temp = this.params['optstring'].substring(this.params['optstring'].indexOf(c), this.params['optstring'].length);
        }
        if (this.params['nextchar'] === "") {
            ++this.params['optind'];
        }
        if ((temp === null) || (c === ':')) {
            if (this.params['opterr']) {
                if (this.params['posixly_correct']) {
                    console.warn(this.name +
                        ` illegal option -- ${this.params['nextchar']}`);
                } else {
                    console.warn(this.name +
                        ` invalid option -- ${this.params['nextchar']}`);
                }
            }
            this.params['optopt'] = c;
            return char.QUESTION_MARK;
        }
        // Convenience. Treat POSIX -W foo same as long option --foo
        if ((temp.charAt(0) === 'W') && (temp.length > 1) && (temp.charAt(1) === ';')) {
            if (this.params['nextchar'] === "") {
                this.params['optarg'] = this.params['nextchar'];
            } else if (this.params['optind'] === this.params['argv'].length) {
                // No further cars in this argv element and no more argv elements
                if (this.params['opterr']) {
                    console.warn(this.name +
                        ` option requires an argument -- ${c}`);
                }
                this.params['optopt'] = c;
                return this.params['optstring'].charAt(0) === ':' ? char.COLON : char.QUESTION_MARK;
            } else {
                // We already incremented `optind' once;
                // increment it again when taking next ARGV-elt as argument.
                this.params['nextchar'] = this.params['argv'][this.params['optind']];
                this.params['optarg'] = this.params['argv'][this.params['optind']];
            }
            c = this.checkLongOption();
            if (this.params['longopt_handled']) {
                return c;
            } else {
                // Let the application handle it
                this.params['nextchar'] = null;
                ++this.params['optind'];
                return char.W;
            }
        }
        if ((temp.length > 1) && (temp.charAt(1) === ':')) {
            if ((temp.length > 2) && (temp.charAt(2) === ':')) {
                // This is an option that accepts and argument optionally
                if (this.params['nextchar'] !== "") {
                    this.params['optarg'] = this.params['nextchar'];
                    ++this.params['optind'];
                } else {
                    this.params['optarg'] = null;
                }
                this.params['nextchar'] = null;
            } else {
                if (this.params['nextchar'] !== "") {
                    this.params['optarg'] = this.params['nextchar'];
                    ++this.params['optind'];
                } else if (this.params['optind'] === this.params['argv'].length) {
                    if (this.params['opterr']) {
                        console.warn(this.name +
                            ` option requires an argument -- ${c}`);
                    }
                    this.params['optopt'] = c;
                    return this.params['optstring'].charAt(0) === ':' ? char.COLON : char.QUESTION_MARK;
                } else {
                    this.params['optarg'] = this.params['argv'][this.params['optind']];
                    ++this.params['optind'];
                    // Ok, here's an obscure Posix case.  If we have o:, and
                    // we get -o -- foo, then we're supposed to skip the --,
                    // end parsing of options, and make foo an operand to -o.
                    // Only do this in Posix mode.
                    if ((this.params['posixly_correct']) && this.params['optarg'] === "--") {
                        // If end of argv, error out
                        if (this.params['optind'] === this.params['argv'].length) {
                            if (this.params['opterr']) {
                                console.warn(this.name +
                                    ` option requires an argument -- ${c}`);
                            }
                            this.params['optopt'] = c;
                            return this.params['optstring'].charAt(0) === ':' ? char.COLON : char.QUESTION_MARK;
                        }
                        // Set new optarg and set to end
                        // Don't permute as we do on -- up above since we
                        // know we aren't in permute mode because of Posix.
                        this.params['optarg'] = this.params['argv'][this.params['optind']];
                        ++this.params['optind'];
                        this.params['first_nonopt'] = this.params['optind'];
                        this.params['last_nonopt'] = this.params['argv'].length;
                        this.params['endparse'] = true;
                    }
                }
                this.params['nextchar'] = null;
            }
        }
        return c.charCodeAt(0);
    }

    getOptarg() {
        return this.params['optarg'];
    }

    getOptind() {
        return this.params['optind'];
    }

    getOptopt() {
        return this.params['optopt'];
    }

    internalExecute(command, ...options) {

    }

    static normalizeNodeArgv(argv) {
        let arr = argv.splice(2, process.argv.length);
        return {
            program: arr[0],
            argv: arr.splice(1, arr.length)
        };
    }

    setArgv(argv) {
        this.params['argv'] = argv;
    }

    setOpterr(opterr) {
        this.params['opterr'] = opterr;
    }

    setOptind(optind) {
        this.params['optind'] = optind;
    }

    setOptstring(optstring) {
        if (optstring.length === 0) {
            this.params['optstring'] = " ";
        }
        this.params['optstring'] = optstring;
    }

}
