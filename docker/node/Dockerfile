FROM node:14-slim

# Docker実行ユーザIDを build-arg から取得
ARG USER_ID

# パッケージインストール時に対話モードを実行しないように設定
ENV DEBIAN_FRONTEND=noninteractive

RUN if [ "$USER_ID" = "" ] || [ "$USER_ID" = "0" ]; then USER_ID=1026; fi && \
    : '日本語対応' && \
    apt-get update && \
    apt-get -y install tzdata locales-all fonts-ipafont fonts-ipaexfont && \
    : 'Add user (User ID: $USER_ID)' && \
    if [ "$(getent passwd $USER_ID)" != "" ]; then usermod -u $((USER_ID + 100)) "$(getent passwd $USER_ID | cut -f 1 -d ':')"; fi && \
    useradd -u $USER_ID -m -s /bin/bash worker && \
    apt-get install -y sudo && \
    echo "worker ALL=NOPASSWD: ALL" >> '/etc/sudoers' && \
    : 'Fix permission' && \
    mkdir -p /usr/local/share/.config/ && \
    chown -R worker /usr/local/share/.config/ && \
    : 'cleanup apt-get caches' && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 日本語環境に設定
ENV TZ Asia/Tokyo
ENV LANG ja_JP.UTF-8
ENV LANGUAGE ja_JP:ja
ENV LC_ALL ja_JP.UTF-8

# 作業ディレクトリ: ./ => file://node:/work/
WORKDIR /work/

# 作業ユーザ: Docker実行ユーザ
## => コンテナ側のコマンド実行で作成されるファイルパーミッションをDocker実行ユーザ所有に
USER worker

# スタートアップコマンド（docker up の度に実行される）
# CMD ["/bin/bash", "-c", "yarn && yarn start"]
