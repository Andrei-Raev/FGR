from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker, declarative_base

engine = create_engine('mysql+pymysql://FGR:*F*uO5f8UWv8@copenakum.beget.app:3306/FGR', pool_pre_ping=True,
                       pool_recycle=3600)
Base = declarative_base()
Session = sessionmaker(bind=engine)


class Question(Base):
    __tablename__ = 'questions'

    id = Column(Integer, primary_key=True)
    hash = Column(String(64), unique=True)
    question_index = Column(Integer)
    test_id = Column(Integer)
    correct_answer = Column(Integer)

# Base.metadata.create_all(engine)
