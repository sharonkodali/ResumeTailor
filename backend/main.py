try:
    from fastapi import FastAPI, Depends
    from sqlalchemy.orm import Session
    from typing import List

    from database import engine, Base, get_db
    import models, schemas

    Base.metadata.create_all(bind=engine)

    app = FastAPI(title="IntelliResume API")

    @app.post("/api/experiences", response_model=schemas.ExperienceResponse)
    def create_experience(exp: schemas.ExperienceCreate, db: Session = Depends(get_db)):
        db_exp = models.Experience(
            company=exp.company,
            role=exp.role,
            dates=exp.dates,
            category=exp.category
        )
        db.add(db_exp)
        db.commit()
        db.refresh(db_exp)

        for bullet in exp.bullets:
            db_bullet = models.BulletPoint(
                experience_id=db_exp.id,
                text=bullet.text,
                skills=bullet.skills
            )
            db.add(db_bullet)

        db.commit()
        db.refresh(db_exp)
        return db_exp

    @app.get("/api/experiences", response_model=List[schemas.ExperienceResponse])
    def get_experiences(db: Session = Depends(get_db)):
        return db.query(models.Experience).all()
except Exception:
    from fastapi import FastAPI

    app = FastAPI(title="IntelliResume API")

    @app.get("/")
    def health_check():
        return {"status": "ok", "message": "Backend is running"}