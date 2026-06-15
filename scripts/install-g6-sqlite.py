#!/usr/bin/env python3
"""G6 SQLite 로컬 자동 설치 (웹 설치 마법사 대체)"""
import os
import secrets
import shutil
import sys

# g6/ 루트를 path에 추가
G6_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G6_DIR = os.path.join(G6_ROOT, "g6")
os.chdir(G6_DIR)
sys.path.insert(0, G6_DIR)

from dotenv import set_key
from sqlalchemy import exists, insert, select

from core.database import DBConnect
from core.models import Base, Board, Config, Content, FaqMaster, Group, Member, QaConfig
from core.settings import ENV_PATH, settings
from install.default_values import (
    default_board_data,
    default_boards,
    default_cache_directory,
    default_config,
    default_contents,
    default_data_directory,
    default_faq_master,
    default_gr_id,
    default_group,
    default_member,
    default_qa_config,
    default_version,
)
from lib.common import dynamic_create_write_table
from lib.pbkdf2 import create_hash

ADMIN_ID = os.environ.get("G6_ADMIN_ID", "lawygo")
ADMIN_PW = os.environ.get("G6_ADMIN_PASSWORD", "lawygo1234!")
ADMIN_NAME = os.environ.get("G6_ADMIN_NAME", "LawyGo관리자")
ADMIN_EMAIL = os.environ.get("G6_ADMIN_EMAIL", "admin@lawygo.local")
PREFIX = "g6_"


def write_env():
    if not os.path.exists("example.env"):
        raise FileNotFoundError("example.env 없음")
    shutil.copyfile("example.env", ENV_PATH)

    session_key = secrets.token_urlsafe(50)
    for key, val in [
        ("DB_ENGINE", "sqlite"),
        ("DB_TABLE_PREFIX", PREFIX),
        ("DB_HOST", ""),
        ("DB_PORT", "0"),
        ("DB_USER", ""),
        ("DB_PASSWORD", ""),
        ("DB_NAME", ""),
        ("SESSION_SECRET_KEY", session_key),
        ("USE_API", "True"),
        ("USE_TEMPLATE", "True"),
        ("APP_IS_DEBUG", "False"),
    ]:
        set_key(ENV_PATH, key, val, quote_mode="never")

    settings.DB_ENGINE = "sqlite"
    settings.DB_TABLE_PREFIX = PREFIX
    settings.SESSION_SECRET_KEY = session_key
    settings.USE_API = True


def install_db():
    db = DBConnect()
    db.set_connect_infomation()
    db.create_url()
    db.create_engine()

    engine = db.engine
    for table in Base.metadata.tables.values():
        table.name = table.name.replace("g6_", PREFIX)

    Base.metadata.create_all(bind=engine)

    with db.sessionLocal() as session:
        if not session.scalar(exists(Config).where(Config.cf_id == 1).select()):
            session.execute(
                insert(Config).values(cf_admin=ADMIN_ID, cf_admin_email=ADMIN_EMAIL, **default_config)
            )

        if not session.scalar(select(Member).where(Member.mb_id == ADMIN_ID)):
            session.execute(
                insert(Member).values(
                    mb_id=ADMIN_ID,
                    mb_password=create_hash(ADMIN_PW),
                    mb_name=ADMIN_NAME,
                    mb_nick=ADMIN_NAME,
                    mb_email=ADMIN_EMAIL,
                    **default_member,
                )
            )

        for content in default_contents:
            if not session.scalar(exists(Content).where(Content.co_id == content["co_id"]).select()):
                session.execute(insert(Content).values(**content))

        if not session.scalar(exists(QaConfig).select()):
            session.execute(insert(QaConfig).values(**default_qa_config))

        if not session.scalar(exists(FaqMaster).where(FaqMaster.fm_id == 1).select()):
            session.execute(insert(FaqMaster).values(**default_faq_master))

        if not session.scalar(exists(Group).where(Group.gr_id == default_gr_id).select()):
            session.execute(insert(Group).values(**default_group))

        for board in default_boards:
            if not session.scalar(exists(Board).where(Board.bo_table == board["bo_table"]).select()):
                session.execute(insert(Board).values(**board, **default_board_data))

        # LawyGo용 case_memo 게시판
        if not session.scalar(exists(Board).where(Board.bo_table == "case_memo").select()):
            session.execute(
                insert(Board).values(
                    bo_table="case_memo",
                    bo_subject="사건 메모",
                    bo_skin="basic",
                    bo_mobile_skin="basic",
                    **default_board_data,
                )
            )

        session.commit()

    for board in default_boards:
        dynamic_create_write_table(board["bo_table"], create_table=True)
    dynamic_create_write_table("case_memo", create_table=True)

    os.makedirs(default_data_directory, exist_ok=True)
    os.makedirs(default_cache_directory, exist_ok=True)

    print(f"G6 SQLite 설치 완료 ({default_version})")
    print(f"  관리자 ID: {ADMIN_ID}")
    print(f"  비밀번호: {ADMIN_PW}")


if __name__ == "__main__":
    if os.path.exists(ENV_PATH):
        db = DBConnect()
        try:
            db.set_connect_infomation()
            db.create_url()
            db.create_engine()
            with db.sessionLocal() as s:
                if s.scalar(exists(Config).where(Config.cf_id == 1).select()):
                    print("G6 이미 설치됨 — 건너뜀")
                    sys.exit(0)
        except Exception:
            pass

    write_env()
    install_db()
