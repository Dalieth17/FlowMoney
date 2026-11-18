CREATE TABLE savings_goals (
  user_id INT NOT NULL,
  id CHAR(36) NOT NULL,
  data JSON NOT NULL,
  PRIMARY KEY (user_id,id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE savings_entries (
  user_id INT NOT NULL,
  id CHAR(36) NOT NULL,
  goal_id CHAR(36) NOT NULL,
  data JSON NOT NULL,
  PRIMARY KEY (user_id,id),
  FOREIGN KEY (user_id,goal_id) REFERENCES savings_goals(user_id,id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
