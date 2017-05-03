#!/usr/bin/python

import sqlite3


# create the database
def generate_database():
	conn = sqlite3.connect(r'yes.db')

	print "Opened database successfully";

	# create tables for basic use information and 
	# websites history
	conn.execute('''CREATE TABLE profile
	       (uid INT PRIMARY KEY AUTOINCREMENT,
	       userName           TEXT    NOT NULL,
	       age            INT,
	       gender        CHAR(50));''')

	conn.execute('''CREATE TABLE history
	       (hid INT PRIMARY KEY AUTOINCREMENT NOT NULL,
	       website           TEXT    NOT NULL,
	       count            INT,
	       user_id INT references profile);''')

	print "Table created successfully";

# insert value into the profile table
def insert_profile(name, age, gender):
	conn.execute("INSERT INTO profile (userName, age, gender) values (?, ?, ?)", (name, age, gender));


# get value from the profile table
def get_profile():
	user = conn.execute("SELECT uid, userName, age, gender from profile");


# insert value into the history table
def insert_history(user_id, website, count):
	conn.execute("INSERT INTO history (website, count, user_id) values (?, ?, ?)", (website, count, user_id));


# get value from the history table
def get_history():
	user = conn.execute("SELECT hid, website, count, user_id from profile");

# close the db file when things done
def close():
	conn.close()


