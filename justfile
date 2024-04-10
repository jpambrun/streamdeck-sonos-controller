sync:
  mutagen sync create --mode one-way-replica --name=sonos --ignore-vcs --ignore=node_modules/ --ignore=package-lock.json . jpambrun@192.168.1.194:~/sonos

stop:
  mutagen sync terminate sonos