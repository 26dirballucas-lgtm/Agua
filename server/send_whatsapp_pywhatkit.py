import argparse
import sys

import pywhatkit


def main():
    parser = argparse.ArgumentParser(description="Enviar código de recuperação pelo WhatsApp Web.")
    parser.add_argument("--phone", required=True)
    parser.add_argument("--message", required=True)
    parser.add_argument("--wait-time", default=20, type=int)
    parser.add_argument("--close-tab", action="store_true")
    args = parser.parse_args()

    try:
        pywhatkit.sendwhatmsg_instantly(
            phone_no=args.phone,
            message=args.message,
            wait_time=args.wait_time,
            tab_close=args.close_tab,
            close_time=3,
        )
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
