#!/bin/bash

# Set your tokens here
WIFE_TOKEN="EAAituX6sEt8BQCf4yBEhFcEUnzPZAfK39VMF1AuOiq2lrnLh1TNYhD5cCZCy97U3iTbLZAD55ZAJOpbyxh9tmJ3k0F0m5Q0ZCg56Ht55SD3ITvLRlz2YOSLXrZBOLry9GvKuFmaSU3CZAKgzenBfHZCW3pMmevSx5qAkzZCgip6jxIzqCRItzedmCC0KErS5g7fZBvUg4bdCn9DBW14hvSkZAm6y23Ex7CjGZAZBE7TxFVKrJgLTXVcdFAmINDEjDzz6sKqCfN51LSltAHZCmOugHj7C3UEwYhfwocBkmZC"
SON_TOKEN="EAAituX6sEt8BQG9kGNSibWpQIHgEMJCjn5ZBQ6sasTTXSu5IAb50xnwbLVvUABwRVP1eQZBSlc20KZA73ZCxWQGTGOMCX2SHrO4agGHJdDZC88SxKfZA7MMaZCCNyWH8gnRutvgouR0HZCHJArq5VJrQrMwtIiYlhqudcPsf0wBXqmdTNe6Wa2n9ZAIL8MPZB3zlNf3srW9nyP7eMZA6ztRE6KnLZBbZBeMt7VEfInalDlXZASZCgDW3kflelcCaqkAXR2IgQmhcQs7SbrGDRvLphsocI7Vu97zFg5RpJgCIMFh9CHxFzLykjzavAZDZD"
SOCIALMONKEY_TOKEN="EAAituX6sEt8BQOylatvE97RzGufVsZBpWtgdVnx50eftT9mVhGZB0pKQtBToBu60RvVLIu0cNTTq7V6IZBweZBsmRUHmiSk4a3eq8c1P54k2moKfCTonwt6dtchX8054L6eEDgUgEv6lyUZA4v9gZC8miwBCuyKZAZBfaWGWOyavt74AZCZCGnJVVAmNJB4e55ocEw50b1QZCs4ZBLZBAyE5Ol5Nqr7aW28LfiVMk3r1QZA4id9ZB0jXTtbg6yqWHYn6ihpaimMoC60JpZCuYJfZC3uvZALZAeSCZAYp2nsFkauwyBdUbIotd0KVFzqwVwZDZD"


# Function to call /me/accounts
check_pages() {
  local NAME="$1"
  local TOKEN="$2"

  echo "===================================================="
  echo " Checking pages for: $NAME"
  echo "===================================================="

  curl -s "https://graph.facebook.com/v21.0/me/accounts?fields=id,name,tasks,access_token&access_token=$TOKEN"
  echo
}

check_pages "Wife" "$WIFE_TOKEN"
check_pages "Son" "$SON_TOKEN"
check_pages "SocialMonkey" "$SOCIALMONKEY_TOKEN"