# face_recognition on the AWS Python 3.11 base, using the prebuilt dlib-bin
# wheel (no source compile — builds in well under a minute).
#
# Two build targets:
#   docker build --platform linux/amd64 --target lambda -t framefind-faces .
#       -> the Lambda container image (default; see DEPLOYMENT.md Part 3)
#   docker build --target local -t framefind-face-worker .
#       -> a plain HTTP worker for the local Docker stack (no AWS)
#
# `--target lambda` is last so a bare `docker build .` still produces the
# Lambda image.

FROM public.ecr.aws/lambda/python:3.11 AS base

COPY requirements.txt .
# dlib-bin provides the `dlib` module; install it (+ the models) first, then
# face_recognition WITHOUT deps so pip doesn't try to build the `dlib` sdist;
# then the remaining runtime libs.
RUN pip install --no-cache-dir dlib-bin==19.24.6 face-recognition-models==0.3.0 \
 && pip install --no-cache-dir --no-deps face_recognition==1.3.0 \
 && pip install --no-cache-dir click "numpy==1.26.4" "Pillow==10.4.0" "boto3==1.34.144"

COPY face_index_handler.py face_search_handler.py ${LAMBDA_TASK_ROOT}/

# --- Local HTTP worker: same code, exposed over HTTP for docker-compose ----
FROM base AS local
COPY local_server.py ${LAMBDA_TASK_ROOT}/
ENV FACE_WORKER_PORT=9000
EXPOSE 9000
ENTRYPOINT []
CMD ["python3.11", "local_server.py"]

# --- Lambda container image (default) -------------------------------------
FROM base AS lambda
# Default handler; the search function overrides this to
# face_search_handler.handler in its function config.
CMD ["face_index_handler.handler"]
